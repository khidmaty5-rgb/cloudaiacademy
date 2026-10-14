import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getAuthorizedUserRole } from '@/server/effective-user-role';
import { isUserRole } from '@/lib/user-roles';
import { randomUUID } from 'node:crypto';
import { changeUserRole, RoleChangeError } from '@/server/role-change';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminApp';
  const existing = getApps().find(a => a.name === name);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  if (usingEmulators) {
    console.log('[adminApp] Using emulators with projectId:', projectId);
    return initializeApp({ projectId }, name);
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  if (projectId && clientEmail && privateKey) {
    console.log('[adminApp] Using env service account with projectId:', projectId);
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  // Literal candidates avoid recursive wildcard discovery during Next tracing.
  const tryPaths: string[] = [
    path.join(process.cwd(), 'config', 'serviceAccount.local.json'),
    path.join(process.cwd(), '..', 'config', 'serviceAccount.local.json'),
    path.join(process.cwd(), '../..', 'config', 'serviceAccount.local.json'),
    path.join(process.cwd(), '../../..', 'config', 'serviceAccount.local.json'),
    path.join(process.cwd(), '../../../..', 'config', 'serviceAccount.local.json'),
  ];
  if (explicitPath) tryPaths.unshift(explicitPath);
  for (const p of tryPaths) {
    try {
      if (p && existsSync(p)) {
        const raw = readFileSync(p, 'utf8');
        const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
        const pId = sa.project_id || projectId;
        if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = pId;
        if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = pId;
        const pk = sa.private_key?.includes('\\n') ? sa.private_key.replace(/\\n/g, '\n') : sa.private_key;
        console.log('[adminApp] Using local service account at', p, 'projectId:', pId);
        return initializeApp({ credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId }, name);
      }
    } catch {}
  }
  console.log('[adminApp] Using applicationDefault credentials with projectId:', projectId);
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const requesterUid = decoded.uid || decoded.sub;
    const requesterRoleRaw = (decoded as any)?.role as string | undefined;

    const db = getFirestore(app);
    const requesterRole = requesterUid
      ? await getAuthorizedUserRole(db, requesterUid, requesterRoleRaw, ['admin'])
      : null;
    const { userId, role, requestId: suppliedId, reason } = await req.json();
    const hasRole = typeof role === 'string' && role.length > 0;
    if (typeof userId !== 'string' || !userId || userId.length > 128 || userId.includes('/') ||
      (role !== undefined && !isUserRole(role)) ||
      (suppliedId !== undefined && (typeof suppliedId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(suppliedId))) ||
      (reason !== undefined && (typeof reason !== 'string' || reason.length > 500))) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Self-sync: allow a signed-in user to refresh their own role claim to match
    // the role stored in their Firestore profile document. This avoids requiring
    // an already-admin claim just to get the correct claims after a role update.
    if (requesterUid === userId) {
      const userSnap = await db.doc(`users/${userId}`).get();
      const desiredRole = userSnap.exists ? ((userSnap.data() as any)?.role as string | undefined) : undefined;
      if (!userSnap.exists) {
        return NextResponse.json({ ok: true, selfSync: true, updated: false }, { status: 200 });
      }

      if (!isUserRole(desiredRole)) return NextResponse.json({error:'INVALID_CURRENT_ROLE'}, {status:409});

      // If a role was provided by the client, require it to match what's stored.
      if (hasRole && desiredRole !== role) {
        return NextResponse.json({ error: 'Role mismatch' }, { status: 400 });
      }

      const currentClaimRole = requesterRoleRaw;
      const needsUpdate = currentClaimRole !== desiredRole;

      if (needsUpdate) {
        const account = await getAuth(app).getUser(userId);
        await getAuth(app).setCustomUserClaims(userId, { ...account.customClaims, role: desiredRole });
      }
      return NextResponse.json({ ok: true, selfSync: true, updated: needsUpdate, role: desiredRole }, { status: 200 });
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (!requesterRole || !requesterUid) return NextResponse.json({error:'Forbidden'}, {status:403});
    const result = await changeUserRole(db, requesterUid, userId, role, suppliedId || randomUUID(), reason);
    let claimsSyncPending = false;
    try {
      // Sync the latest authoritative profile, never resurrect an earlier role.
      const latest = await db.doc(`users/${userId}`).get();
      const latestRole = latest.data()?.role;
      if (!isUserRole(latestRole)) throw new Error('Role is unavailable');
      const account = await getAuth(app).getUser(userId);
      await getAuth(app).setCustomUserClaims(userId, {...account.customClaims, role:latestRole});
      if (result.auditId) await db.doc(`roleChangeAudit/${result.auditId}`).update({claimsSync:'complete'});
    } catch {
      // Profile + audit already committed. Retrying the same request ID is safe.
      claimsSyncPending = true;
    }
    return NextResponse.json({ok:true, ...result, claimsSyncPending}, {status:200});
  } catch (e: any) {
    if (e instanceof RoleChangeError) return NextResponse.json({error:e.code},{status:e.status});
    console.error('update-user-role error:', e);
    const status = e?.code === 'auth/argument-error' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status });
  }
}
