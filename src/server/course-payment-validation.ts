export type CoursePaymentExpectation = {
  uid: string;
  courseId: string;
  amountCents: number;
  currency: string;
};

export type PaymentValidationResult =
  | { ok: true }
  | { ok: false; status: 400 | 403; error: string };

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function metadataFrom(session: Record<string, unknown>) {
  const raw = session.metadata;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function normalizePriceToCents(price: unknown): number | null {
  if (typeof price === 'number' && Number.isFinite(price)) {
    if (price <= 0) return 0;
    return Math.round(price * 100);
  }

  if (typeof price !== 'string') return null;
  const raw = price.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (lowered === 'free' || lowered === '$0' || lowered === '0' || lowered === '0.00') return 0;

  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function validateStripeCourseSession(
  session: Record<string, unknown>,
  expected: CoursePaymentExpectation,
): PaymentValidationResult {
  if (!stringValue(session.id)) {
    return { ok: false, status: 400, error: 'Checkout session has no transaction ID.' };
  }
  if (stringValue(session.payment_status).toLowerCase() !== 'paid') {
    return { ok: false, status: 400, error: 'Checkout session is not paid yet.' };
  }
  if (stringValue(session.status).toLowerCase() !== 'complete') {
    return { ok: false, status: 400, error: 'Checkout session is not complete.' };
  }
  if (stringValue(session.mode).toLowerCase() !== 'payment') {
    return { ok: false, status: 400, error: 'Checkout session is not a one-time payment.' };
  }

  const metadata = metadataFrom(session);
  if (stringValue(metadata.paymentType) !== 'course') {
    return { ok: false, status: 400, error: 'This checkout session is not for a course purchase.' };
  }
  if (stringValue(metadata.courseId) !== expected.courseId) {
    return { ok: false, status: 400, error: 'Checkout session does not match this course.' };
  }
  if (stringValue(metadata.firebaseUid) !== expected.uid) {
    return { ok: false, status: 403, error: 'Checkout session does not match this user.' };
  }

  const clientReferenceId = stringValue(session.client_reference_id);
  if (clientReferenceId && clientReferenceId !== expected.uid) {
    return { ok: false, status: 403, error: 'Checkout session does not match this user.' };
  }
  if (
    typeof session.amount_total !== 'number' ||
    !Number.isInteger(session.amount_total) ||
    session.amount_total !== expected.amountCents
  ) {
    return { ok: false, status: 400, error: 'Checkout amount does not match course price.' };
  }
  if (stringValue(session.currency).toUpperCase() !== expected.currency.trim().toUpperCase()) {
    return { ok: false, status: 400, error: 'Checkout currency does not match payment settings.' };
  }

  return { ok: true };
}

export type PaypalCoursePayment = {
  status: string;
  customId: string;
  currency: string;
  value: string;
  captureId: string;
  captureStatus: string;
};

export function validatePaypalCoursePayment(
  payment: PaypalCoursePayment,
  expected: CoursePaymentExpectation,
): PaymentValidationResult {
  if (payment.customId !== `${expected.uid}:${expected.courseId}`) {
    return { ok: false, status: 403, error: 'PayPal order does not match this user/course.' };
  }
  if (payment.status.toUpperCase() !== 'COMPLETED') {
    return {
      ok: false,
      status: 400,
      error: `PayPal order is not completed (status=${payment.status}).`,
    };
  }
  if (!payment.captureId || payment.captureStatus.toUpperCase() !== 'COMPLETED') {
    return { ok: false, status: 400, error: 'PayPal payment capture is not completed.' };
  }
  if (payment.value !== (expected.amountCents / 100).toFixed(2)) {
    return { ok: false, status: 400, error: 'PayPal amount does not match course price.' };
  }
  if (payment.currency.toUpperCase() !== expected.currency.trim().toUpperCase()) {
    return { ok: false, status: 400, error: 'PayPal currency does not match payment settings.' };
  }

  return { ok: true };
}
