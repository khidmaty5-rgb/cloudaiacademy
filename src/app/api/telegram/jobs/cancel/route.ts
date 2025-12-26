import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppTelegramJobsCancel';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  if (usingEmulators) return initializeApp({ projectId }, name);
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '') : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
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

    const { jobId } = await req.json();
    if (!jobId || typeof jobId !== 'string') return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });

    const db = getFirestore(app);
    const ref = db.collection('tg_jobs').doc(jobId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snap.data() as any;
    if (data.providerId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (data.status !== 'scheduled') return NextResponse.json({ error: 'Cannot cancel' }, { status: 400 });

    await ref.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
