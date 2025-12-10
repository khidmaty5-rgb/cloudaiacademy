'use client';

import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Ensures the user's custom claims match the role in their Firestore user document.
 * Returns true if a sync was attempted (and claims were refreshed), false if no action was needed.
 */
export async function ensureUserClaimsSync(auth: Auth, firestore: Firestore, user: User): Promise<boolean> {
  if (!auth || !firestore || !user) return false;

  const userDocRef = doc(firestore, 'users', user.uid);
  const snap = await getDoc(userDocRef);
  const desiredRole = snap.exists() ? ((snap.data() as any)?.role as string | undefined) : undefined;
  if (!desiredRole) return false;

  const tokenResult = await user.getIdTokenResult();
  const claimRole = (tokenResult.claims as any)?.role;
  if (claimRole === desiredRole) return false;

  const token = await user.getIdToken();
  const resp = await fetch('/api/admin/update-user-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ userId: user.uid, role: desiredRole }),
  });

  if (!resp.ok) {
    let msg = 'Claim sync failed';
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  await user.getIdToken(true);

  try {
    const post = await user.getIdTokenResult();
    const postRole = (post.claims as any)?.role;
    if (postRole !== desiredRole) {
      // Not throwing; log a soft warning so caller can decide
      // eslint-disable-next-line no-console
      console.warn('[ClaimSync] Role mismatch after sync:', { desiredRole, postRole });
    }
  } catch {}

  return true;
}
