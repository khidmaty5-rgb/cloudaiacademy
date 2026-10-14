import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { ClaimRecoveryError, recoverRoleClaims } from '@/server/role-claim-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ClaimRecoveryError('UNAUTHORIZED', 401);
  const auth = getFirebaseAdminAuth();
  let uid: string;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { throw new ClaimRecoveryError('UNAUTHORIZED', 401); }
  const db = getFirebaseAdminFirestore();
  if (!uid || (await db.doc(`users/${uid}`).get()).data()?.role !== 'admin')
    throw new ClaimRecoveryError('FORBIDDEN', 403);
  return { auth, db, uid };
}
function failure(error: unknown) {
  const known = error instanceof ClaimRecoveryError;
  return NextResponse.json({ error: known ? error.code : 'SYNC_UNAVAILABLE' },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function GET(req: NextRequest) {
  try {
    const { db } = await authorize(req);
    const pending = await db.collection('roleChangeAudit').where('claimsSync', '==', 'pending').limit(20).get();
    return NextResponse.json({ events: pending.docs.map(event => ({ id: event.id,
      targetUid: event.data().targetUid, newRole: event.data().newRole })) },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    const { auth, db, uid } = await authorize(req);
    let payload;
    try { payload = await req.json(); } catch { throw new ClaimRecoveryError('INVALID_INPUT', 400); }
    const auditId = payload?.auditId;
    if (typeof auditId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(auditId))
      throw new ClaimRecoveryError('INVALID_INPUT', 400);
    const result = await recoverRoleClaims(db, auth, uid, auditId);
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
