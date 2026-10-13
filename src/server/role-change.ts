import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { isUserRole, type UserRole } from '@/lib/user-roles';

export class RoleChangeError extends Error {
  constructor(public code:string, public status:number) { super(code); }
}

export async function changeUserRole(db:Firestore, actorUid:string, targetUid:string,
  role:UserRole, requestId:string, reason?:string) {
  const actorRef=db.doc(`users/${actorUid}`);
  const targetRef=db.doc(`users/${targetUid}`);
  const lockRef=db.doc('securityState/adminRoleChanges');
  const auditRef=db.doc(`roleChangeAudit/${requestId}`);
  return db.runTransaction(async tx => {
    // All role-changing transactions read/write the same lock: two concurrent
    // demotions cannot each conclude that the other administrator will remain.
    const [actor,target,lock,audit]=await Promise.all([
      tx.get(actorRef),tx.get(targetRef),tx.get(lockRef),tx.get(auditRef),
    ]);
    if (!actor.exists || actor.data()?.role !== 'admin') throw new RoleChangeError('FORBIDDEN',403);
    if (!target.exists) throw new RoleChangeError('USER_NOT_FOUND',404);
    const previousRole=target.data()?.role;
    if (!isUserRole(previousRole)) throw new RoleChangeError('INVALID_CURRENT_ROLE',409);
    if (actorUid === targetUid && previousRole !== role) throw new RoleChangeError('SELF_ROLE_CHANGE_DENIED',403);
    if (audit.exists) {
      const saved=audit.data();
      if (saved?.actorUid !== actorUid || saved?.targetUid !== targetUid || saved?.newRole !== role)
        throw new RoleChangeError('REQUEST_ID_CONFLICT',409);
      if (previousRole !== role) throw new RoleChangeError('STALE_ROLE_CHANGE_REQUEST',409);
      return {changed:false,auditId:auditRef.id};
    }
    if (previousRole === role) return {changed:false,auditId:null};
    if (previousRole === 'admin' && role !== 'admin') {
      const admins=await tx.get(db.collection('users').where('role','==','admin').limit(2));
      if (admins.size < 2) throw new RoleChangeError('LAST_ADMINISTRATOR',409);
    }
    tx.update(targetRef,{role});
    tx.set(lockRef,{version:(Number(lock.data()?.version)||0)+1});
    tx.create(auditRef,{actorUid,targetUid,previousRole,newRole:role,
      timestamp:FieldValue.serverTimestamp(),reason:reason||null,claimsSync:'pending'});
    return {changed:true,auditId:auditRef.id};
  });
}
