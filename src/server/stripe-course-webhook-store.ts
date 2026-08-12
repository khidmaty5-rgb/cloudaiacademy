import type { Firestore } from 'firebase-admin/firestore';
import { decideStripeCourseFulfillment } from './stripe-course-webhook';

export type StripeCourseFulfillmentInput = {
  eventId: string;
  eventType: string;
  eventCreated?: number;
  uid: string;
  courseId: string;
  courseTitle?: string;
  sessionId: string;
  customerId?: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
};

export async function fulfillStripeCourseWebhook(
  db: Firestore,
  input: StripeCourseFulfillmentInput,
) {
  const eventRef = db.doc(`billingWebhookEvents/${input.eventId}`);
  const sessionRef = db.doc(`stripeCourseSessions/${input.sessionId}`);
  const purchaseRef = db.doc(`users/${input.uid}/coursePurchases/${input.courseId}`);
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const [eventSnap, sessionSnap, purchaseSnap] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(sessionRef),
      transaction.get(purchaseRef),
    ]);
    const sessionBinding = sessionSnap.exists
      ? (sessionSnap.data() as { uid?: string; courseId?: string })
      : null;
    const purchase = purchaseSnap.exists
      ? (purchaseSnap.data() as { status?: string; stripeCheckoutSessionId?: string; paidAt?: unknown })
      : null;
    const decision = decideStripeCourseFulfillment(
      { uid: input.uid, courseId: input.courseId, sessionId: input.sessionId },
      { eventProcessed: eventSnap.exists, sessionBinding, purchase },
    );
    if (decision === 'replayed_event') return decision;

    transaction.set(eventRef, {
      provider: 'stripe',
      eventType: input.eventType,
      eventCreated: input.eventCreated ?? null,
      sessionId: input.sessionId,
      uid: input.uid,
      courseId: input.courseId,
      outcome: decision,
      processedAt: now,
    });

    if (decision === 'session_binding_conflict') return decision;

    transaction.set(
      sessionRef,
      {
        uid: input.uid,
        courseId: input.courseId,
        ...(!sessionBinding ? { firstEventId: input.eventId } : {}),
        updatedAt: now,
      },
      { merge: true },
    );

    if (decision !== 'fulfill') return decision;

    transaction.set(
      purchaseRef,
      {
        courseId: input.courseId,
        ...(input.courseTitle ? { courseTitle: input.courseTitle } : {}),
        ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
        stripeCheckoutSessionId: input.sessionId,
        ...(input.paymentIntentId ? { stripePaymentIntentId: input.paymentIntentId } : {}),
        amount: input.amount,
        currency: input.currency,
        status: 'PAID',
        paidAt: purchase?.paidAt || now,
        confirmedAt: now,
        confirmedBy: 'stripe_webhook',
        stripeWebhookEventId: input.eventId,
      },
      { merge: true },
    );
    return decision;
  });
}
