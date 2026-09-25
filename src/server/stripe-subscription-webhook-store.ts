import type { Firestore } from 'firebase-admin/firestore';
import {
  parseStripeSubscriptionSnapshot,
  stripeSubscriptionGrantsAccess,
  type StripeSubscriptionSnapshot,
} from './stripe-subscription-webhook';

export type StripeSubscriptionSyncInput = {
  eventId: string;
  eventType: string;
  eventCreated?: number;
  subscriptionId: string;
};

export type StripeSubscriptionSyncDependencies = {
  loadCurrentSubscription: (subscriptionId: string) => Promise<unknown>;
  findUserIdByCustomerId: (customerId: string) => Promise<string | null>;
  now?: () => Date;
};

export type StripeSubscriptionSyncOutcome = 'applied' | 'replayed_event';

type ExistingSubscriptionState = {
  uid?: string;
  customerId?: string;
};

type ExistingUser = {
  stripeCustomerId?: string;
};

function bindingConflicts(
  current: StripeSubscriptionSnapshot,
  uid: string,
  state: ExistingSubscriptionState | null,
  user: ExistingUser | null,
) {
  if (state?.uid && state.uid !== uid) return true;
  if (state?.customerId && state.customerId !== current.customerId) return true;
  if (user?.stripeCustomerId && user.stripeCustomerId !== current.customerId) return true;
  return false;
}

export async function syncStripeSubscriptionWebhook(
  db: Firestore,
  input: StripeSubscriptionSyncInput,
  dependencies: StripeSubscriptionSyncDependencies,
): Promise<StripeSubscriptionSyncOutcome> {
  const eventRef = db.doc(`billingWebhookEvents/${input.eventId}`);
  const subscriptionRef = db.doc(`stripeSubscriptionStates/${input.subscriptionId}`);

  return db.runTransaction(async (transaction) => {
    // Reading the subscription state serializes concurrent deliveries for this subscription.
    // Firestore retries this callback after a conflict, which also refreshes Stripe's source of truth.
    const [eventSnap, stateSnap] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(subscriptionRef),
    ]);
    if (eventSnap.exists) return 'replayed_event';

    const current = parseStripeSubscriptionSnapshot(
      await dependencies.loadCurrentSubscription(input.subscriptionId),
    );
    if (!current || current.id !== input.subscriptionId) {
      throw new Error('Stripe returned an invalid or mismatched subscription.');
    }

    const uid =
      current.firebaseUid ||
      (await dependencies.findUserIdByCustomerId(current.customerId)) ||
      '';
    if (!uid) {
      throw new Error('Stripe subscription is not bound to a CloudAI Academy user.');
    }
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await transaction.get(userRef);
    const state = stateSnap.exists
      ? (stateSnap.data() as ExistingSubscriptionState)
      : null;
    const user = userSnap.exists ? (userSnap.data() as ExistingUser) : null;
    const now = dependencies.now?.() ?? new Date();

    if (bindingConflicts(current, uid, state, user)) {
      throw new Error('Stripe subscription customer binding conflicts with existing data.');
    }

    transaction.set(eventRef, {
      provider: 'stripe',
      eventType: input.eventType,
      eventCreated: input.eventCreated ?? null,
      subscriptionId: input.subscriptionId,
      customerId: current.customerId,
      uid,
      outcome: 'applied',
      processedAt: now,
    });

    transaction.set(
      subscriptionRef,
      {
        customerId: current.customerId,
        status: current.status,
        uid,
        lastEventId: input.eventId,
        lastEventType: input.eventType,
        lastEventCreated: input.eventCreated ?? null,
        lastOutcome: 'applied',
        syncedAt: now,
      },
      { merge: true },
    );

    const active = stripeSubscriptionGrantsAccess(current.status);
    transaction.set(
      userRef,
      {
        requirePayment: !active,
        billingStatus: active ? 'ACTIVE' : 'REQUIRES_PAYMENT',
        billingUpdatedAt: now,
        stripeCustomerId: current.customerId,
        stripeSubscriptionId: current.id,
        stripeSubscriptionStatus: current.status,
        ...(current.planId ? { billingPlanId: current.planId } : {}),
        ...(current.interval ? { billingInterval: current.interval } : {}),
        stripeSubscriptionSyncedAt: now,
        stripeSubscriptionEventId: input.eventId,
      },
      { merge: true },
    );
    return 'applied';
  });
}
