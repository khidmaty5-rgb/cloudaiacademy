export const STRIPE_SUBSCRIPTION_WEBHOOK_EVENTS = [
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;

export type StripeSubscriptionWebhookEventType =
  (typeof STRIPE_SUBSCRIPTION_WEBHOOK_EVENTS)[number];

export type StripeSubscriptionSnapshot = {
  id: string;
  customerId: string;
  status: string;
  firebaseUid?: string;
  planId?: string;
  interval?: string;
};

function pickString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function objectFrom(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function objectId(value: unknown) {
  if (typeof value === 'string') return value.trim();
  return pickString(objectFrom(value).id);
}

export function isStripeSubscriptionWebhookEvent(
  type: string,
): type is StripeSubscriptionWebhookEventType {
  return STRIPE_SUBSCRIPTION_WEBHOOK_EVENTS.includes(
    type as StripeSubscriptionWebhookEventType,
  );
}

export function getStripeSubscriptionId(value: unknown) {
  const id = pickString(objectFrom(value).id);
  return /^sub_[a-zA-Z0-9_]+$/.test(id) ? id : null;
}

export function parseStripeSubscriptionSnapshot(
  value: unknown,
): StripeSubscriptionSnapshot | null {
  const subscription = objectFrom(value);
  const id = getStripeSubscriptionId(subscription);
  const customerId = objectId(subscription.customer);
  const status = pickString(subscription.status).toLowerCase();
  if (!id || !/^cus_[a-zA-Z0-9_]+$/.test(customerId) || !status) return null;

  const metadata = objectFrom(subscription.metadata);
  const items = objectFrom(subscription.items);
  const firstItem = Array.isArray(items.data) ? objectFrom(items.data[0]) : {};
  const price = objectFrom(firstItem.price);
  const recurring = objectFrom(price.recurring);
  const firebaseUid = pickString(metadata.firebaseUid);
  const planId = pickString(metadata.planId);
  const interval = pickString(metadata.interval) || pickString(recurring.interval);

  if (firebaseUid.includes('/')) return null;
  return {
    id,
    customerId,
    status,
    ...(firebaseUid ? { firebaseUid } : {}),
    ...(planId ? { planId } : {}),
    ...(interval ? { interval } : {}),
  };
}

export function stripeSubscriptionGrantsAccess(status: string) {
  return status === 'active' || status === 'trialing';
}
