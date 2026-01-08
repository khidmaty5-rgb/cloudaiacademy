'use client';

import { getAuth } from 'firebase/auth';

export async function startCourseCheckout(courseId: string) {
  const id = (courseId || '').trim();
  if (!id) throw new Error('Missing courseId.');

  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('You must be logged in to checkout.');

  const resp = await fetch('/api/billing/course-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ courseId: id }),
  });

  const json = (await resp.json().catch(() => null)) as any;
  if (!resp.ok || !json?.url) {
    const msg = json?.error || 'Failed to start checkout.';
    throw new Error(msg);
  }

  window.location.href = String(json.url);
}

export async function confirmCoursePurchase(
  courseId: string,
  paymentId?: string,
  provider?: 'stripe' | 'paypal',
) {
  const id = (courseId || '').trim();
  if (!id) throw new Error('Missing courseId.');
  const pid = (paymentId || '').trim();

  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('You must be logged in to confirm payment.');

  const payload: Record<string, unknown> = { courseId: id };
  if (provider === 'paypal') {
    if (pid) payload.orderId = pid;
  } else {
    if (pid) payload.sessionId = pid;
  }

  const resp = await fetch('/api/billing/course-confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json().catch(() => null)) as any;
  if (!resp.ok || !json?.ok) {
    const msg = json?.error || 'Failed to confirm payment.';
    throw new Error(msg);
  }
  return json;
}
