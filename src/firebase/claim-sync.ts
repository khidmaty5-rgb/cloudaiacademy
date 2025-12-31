'use client';

import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Ensures the user's custom claims match the role in their Firestore user document.
 * Returns true if a sync was attempted (and claims were refreshed), false if no action was needed.
 */
export async function ensureUserClaimsSync(auth: Auth, firestore: Firestore, user: User): Promise<boolean> {
  if (!auth || !firestore || !user) return false;

  const token = await user.getIdToken();
  const resp = await fetch('/api/admin/update-user-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    // Server reads desired role from Firestore; client just requests a sync.
    body: JSON.stringify({ userId: user.uid }),
  });

  if (!resp.ok) {
    let msg = 'Claim sync failed';
    try {
      const j = await resp.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  const payload = await resp.json().catch(() => null as any);
  const updated = !!payload?.updated;
  const desiredRole = (payload?.role as string | undefined) ?? undefined;

  // If the server reports no role or no changes needed, we're done.
  if (!desiredRole || !updated) return false;

  // Refresh token to pick up new claims.
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
