import type { Firestore } from 'firebase-admin/firestore';

import type { UserRole } from '@/types/models';

export function normalizeUserRole(value: unknown): UserRole | null {
  return value === 'admin' ||
    value === 'teacher' ||
    value === 'reviewer' ||
    value === 'editor' ||
    value === 'student'
    ? value
    : null;
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
