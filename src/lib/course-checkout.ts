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

