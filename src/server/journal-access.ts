import type { Firestore } from 'firebase-admin/firestore';

export type JournalAccessRole = 'admin' | 'editor' | 'reviewer' | 'teacher' | 'student';

function normalizeRole(value: unknown): JournalAccessRole | undefined {
  return value === 'admin' ||
    value === 'editor' ||
    value === 'reviewer' ||
    value === 'teacher' ||
    value === 'student'
    ? value
    : undefined;
}

export function resolveEffectiveJournalRole(
  claimedRole: unknown,
  profileExists: boolean,
  profileRole: unknown,
): JournalAccessRole | undefined {
  if (profileExists) {
    return normalizeRole(profileRole);
  }
  return normalizeRole(claimedRole);
}

export async function getEffectiveJournalRole(
  db: Firestore,
  uid: string,
  claimedRole: unknown,
): Promise<JournalAccessRole | undefined> {
  const profileSnap = await db.doc(`users/${uid}`).get();
  return resolveEffectiveJournalRole(
    claimedRole,
    profileSnap.exists,
    profileSnap.exists ? profileSnap.data()?.role : undefined,
  );
}

export function isJournalEditorialStaff(role: unknown): boolean {
  return role === 'admin' || role === 'editor';
}
