import { NextRequest, NextResponse } from 'next/server';
import { getApps, getApp, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

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
  const tryPaths: string[] = [];
  if (explicitPath) tryPaths.push(explicitPath);
  const levels = ['', '..', '../..', '../../..', '../../../..'];
  for (const lvl of levels) {
    tryPaths.push(path.join(process.cwd(), lvl, 'config', 'serviceAccount.local.json'));
  }
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
    let decoded: any;
    try {
      decoded = await getAuth(app).verifyIdToken(token);
    } catch (e) {
      // Dev-only fallback: decode token without verification to recover uid locally
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = token.split('.');
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          decoded = payload; // contains 'sub' as uid
          console.warn('[adminApp] Using unverified token payload in development.');
        } catch (e2) {
          throw e;
        }
      } else {
        throw e;
      }
    }
    const requesterUid = decoded.uid || decoded.sub;

    const db = getFirestore(app);
    const { userId, role } = await req.json();
    if (!userId || !role || !['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const requesterDoc = await db.doc(`users/${requesterUid}`).get();
    const requesterRole = requesterDoc.exists ? (requesterDoc.data() as any).role : undefined;

    // Owner email override: allow the configured owner to self-promote to admin for local/dev setup
    if (requesterUid === userId && role === 'admin') {
      const ownerEmail = (process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL || 'dhnos@hotmail.com').toLowerCase();
      const requesterEmail = (decoded.email || '').toLowerCase();
      if (requesterEmail && requesterEmail === ownerEmail) {
        await getAuth(app).setCustomUserClaims(userId, { role: 'admin' });
        await db.doc(`users/${userId}`).set({ role: 'admin' }, { merge: true });
        return NextResponse.json({ ok: true, owner: true }, { status: 200 });
      }
    }

    // Bootstrap: if there are no admins in the system yet, allow the first
    // signed-in user to promote themselves to admin by requesting role 'admin'.
    if (requesterUid === userId && role === 'admin') {
      const adminsSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
      if (adminsSnap.empty) {
        await getAuth(app).setCustomUserClaims(userId, { role: 'admin' });
        await db.doc(`users/${userId}`).set({ role: 'admin' }, { merge: true });
        return NextResponse.json({ ok: true, bootstrap: true }, { status: 200 });
      }
    }

    // Case A: Admin can set any user's role (updates claims and doc)
    if (requesterRole === 'admin') {
      await getAuth(app).setCustomUserClaims(userId, { role });
      await db.doc(`users/${userId}`).set({ role }, { merge: true });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Case B: Non-admin can only sync their own claims to the role stored in their document (no escalation)
    if (requesterUid === userId) {
      const targetDoc = await db.doc(`users/${userId}`).get();
      const storedRole = targetDoc.exists ? (targetDoc.data() as any).role : undefined;
      if (!storedRole || storedRole !== role) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await getAuth(app).setCustomUserClaims(userId, { role: storedRole });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('update-user-role error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
