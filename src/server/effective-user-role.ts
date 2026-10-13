import type { Firestore } from 'firebase-admin/firestore';

import type { UserRole } from '@/types/models';
import { isUserRole } from '@/lib/user-roles';

export function normalizeUserRole(value: unknown): UserRole | null {
  return isUserRole(value) ? value : null;
}

export async function getEffectiveUserRole(
  db: Firestore,
  uid: string,
  tokenRole: unknown,
): Promise<UserRole | null> {
  const profile = await db.doc(`users/${uid}`).get();
  if (profile.exists) {
    return normalizeUserRole(profile.data()?.role);
  }

  return normalizeUserRole(tokenRole);
}

export async function getAuthorizedUserRole(
  db: Firestore,
  uid: string,
  tokenRole: unknown,
  allowedRoles: readonly UserRole[],
): Promise<UserRole | null> {
  const role = await getEffectiveUserRole(db, uid, tokenRole);
  return role && allowedRoles.includes(role) ? role : null;
}
