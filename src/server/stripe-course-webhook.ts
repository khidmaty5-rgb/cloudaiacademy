import { validateStripeCourseSession, type CoursePaymentExpectation } from './course-payment-validation';

export const STRIPE_COURSE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const;

export type StripeCourseWebhookEventType = (typeof STRIPE_COURSE_WEBHOOK_EVENTS)[number];

export type StripeCourseWebhookClassification =
  | { action: 'not_course' }
  | { action: 'ignore'; outcome: string; reason: string }
  | {
      action: 'fulfill';
      uid: string;
      courseId: string;
      sessionId: string;
      customerId?: string;
      paymentIntentId?: string;
      amount: number;
      currency: string;
    };

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function metadataFrom(session: Record<string, unknown>) {
  const raw = session.metadata;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function isStripeCourseWebhookEvent(type: string): type is StripeCourseWebhookEventType {
  return STRIPE_COURSE_WEBHOOK_EVENTS.includes(type as StripeCourseWebhookEventType);
}

export function getStripeCourseIdentity(session: Record<string, unknown>) {
  const metadata = metadataFrom(session);
  if (pickString(metadata.paymentType) !== 'course') return null;

  const uid = pickString(metadata.firebaseUid);
  const courseId = pickString(metadata.courseId);
  if (!uid || uid.includes('/') || !/^[a-zA-Z0-9_-]+$/.test(courseId)) return null;
  return { uid, courseId };
}

export function isStripeCourseSession(session: Record<string, unknown>) {
  return pickString(metadataFrom(session).paymentType) === 'course';
}

export function classifyStripeCourseWebhook(
  eventType: string,
  session: Record<string, unknown>,
  expected: CoursePaymentExpectation,
): StripeCourseWebhookClassification {
  if (!isStripeCourseWebhookEvent(eventType)) return { action: 'not_course' };
  if (!getStripeCourseIdentity(session)) return { action: 'not_course' };

  const validation = validateStripeCourseSession(session, expected);
  if (!validation.ok) {
    const pending = pickString(session.payment_status).toLowerCase() !== 'paid';
    return {
      action: 'ignore',
      outcome: pending ? 'pending_payment' : 'invalid_course_session',
      reason: validation.error,
    };
  }

  const sessionId = pickString(session.id);
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return {
      action: 'ignore',
      outcome: 'invalid_course_session',
      reason: 'Checkout session has an invalid transaction ID.',
    };
  }

  return {
    action: 'fulfill',
    uid: expected.uid,
    courseId: expected.courseId,
    sessionId,
    customerId: pickString(session.customer) || undefined,
    paymentIntentId: pickString(session.payment_intent) || undefined,
    amount: expected.amountCents,
    currency: expected.currency.toLowerCase(),
  };
}

export type ExistingCourseFulfillment = {
  eventProcessed: boolean;
  sessionBinding?: { uid?: string; courseId?: string } | null;
  purchase?: { status?: string; stripeCheckoutSessionId?: string } | null;
};

export type CourseFulfillmentDecision =
  | 'replayed_event'
  | 'session_binding_conflict'
  | 'replayed_session'
  | 'already_entitled'
  | 'fulfill';

export function decideStripeCourseFulfillment(
  expected: { uid: string; courseId: string; sessionId: string },
  existing: ExistingCourseFulfillment,
): CourseFulfillmentDecision {
  if (existing.eventProcessed) return 'replayed_event';
  if (
    existing.sessionBinding &&
    (existing.sessionBinding.uid !== expected.uid ||
      existing.sessionBinding.courseId !== expected.courseId)
  ) {
    return 'session_binding_conflict';
  }

  const existingPaid = existing.purchase?.status?.toUpperCase() === 'PAID';
  const existingSession = existing.purchase?.stripeCheckoutSessionId || '';
  if (existingPaid && existingSession === expected.sessionId) return 'replayed_session';
  if (existingPaid) return 'already_entitled';
  return 'fulfill';
}
