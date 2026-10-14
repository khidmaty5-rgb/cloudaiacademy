import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { isUserRole } from '@/lib/user-roles';

export class ClaimRecoveryError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

// Explicit administrator recovery, not a paid background worker. Never replay
// the event's old role: only synchronize the current authoritative profile.
export async function recoverRoleClaims(db: Firestore, auth: Auth, actorUid: string, auditId: string) {
  const actorRef = db.doc(`users/${actorUid}`);
  const auditRef = db.doc(`roleChangeAudit/${auditId}`);
  const actor = await actorRef.get();
  if (actor.data()?.role !== 'admin') throw new ClaimRecoveryError('FORBIDDEN', 403);
  const audit = await auditRef.get();
  const targetUid = audit.data()?.targetUid;
  if (!audit.exists || typeof targetUid !== 'string' || !targetUid || targetUid.includes('/'))
    throw new ClaimRecoveryError('AUDIT_NOT_FOUND', 404);
  const targetRef = db.doc(`users/${targetUid}`);
  const target = await targetRef.get();
  const role = target.data()?.role;
  if (!isUserRole(role)) throw new ClaimRecoveryError('INVALID_CURRENT_ROLE', 409);
  const account = await auth.getUser(targetUid);
  await auth.setCustomUserClaims(targetUid, { ...account.customClaims, role });
  await db.runTransaction(async tx => {
    const [currentActor, currentTarget] = await Promise.all([tx.get(actorRef), tx.get(targetRef)]);
    if (currentActor.data()?.role !== 'admin') throw new ClaimRecoveryError('FORBIDDEN', 403);
    if (currentTarget.data()?.role !== role) throw new ClaimRecoveryError('PROFILE_CHANGED_RETRY', 409);
    tx.update(auditRef, { claimsSync: 'complete', claimsSyncedRole: role,
      claimsSyncedBy: actorUid, claimsSyncedAt: FieldValue.serverTimestamp() });
  });
  return { role };
}
