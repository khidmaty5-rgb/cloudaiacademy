import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppTelegramConnectStart';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

  if (usingEmulators) {
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }), projectId },
      name,
    );
  }

  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

async function verifyIdTokenOrDecode(app: App, idToken: string) {
  try {
    return await getAuth(app).verifyIdToken(idToken);
  } catch (e) {
    if (process.env.NODE_ENV === 'production') throw e;
    const parts = idToken.split('.');
    if (parts.length !== 3) throw e;
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  }
}

function isProviderRole(role: any): boolean {
  return role === 'admin' || role === 'teacher';
}

function genCode(len = 10): string {
  let s = '';
  while (s.length < len) s += Math.random().toString(36).slice(2);
  return s.slice(0, len).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    const decoded: any = await verifyIdTokenOrDecode(app, idToken);
    const uid = decoded?.uid || decoded?.user_id || decoded?.sub;
    const role = (decoded as any)?.role as string | undefined;
    if (!uid || !isProviderRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const db = getFirestore(app);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let code = genCode(10);
    for (let i = 0; i < 3; i++) {
      const docRef = db.collection('tg_connect_requests').doc(code);
      const exists = await docRef.get();
      if (!exists.exists) {
        await docRef.set({
          providerId: uid,
          expiresAt,
          used: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        return NextResponse.json({ ok: true, code, expiresAt: expiresAt.toISOString() }, { status: 200 });
      }
      code = genCode(10);
    }

    return NextResponse.json({ error: 'Could not allocate code' }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
