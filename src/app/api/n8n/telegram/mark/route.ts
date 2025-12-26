import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppN8nTelegramMark';
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
  if (projectId && clientEmail && privateKey) return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

export async function POST(req: NextRequest) {
  try {
    const secret = (req.headers.get('x-n8n-secret') || req.headers.get('X-N8N-SECRET') || '').trim();
    const expected = (process.env.N8N_WEBHOOK_SECRET || '').trim();
    if (!expected || secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, status, telegramMessageId = null, error = null } = await req.json();
    if (!jobId || typeof jobId !== 'string') return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
    if (!['sent', 'failed'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const app = getAdminApp();
    const db = getFirestore(app);

    const ref = db.collection('tg_jobs').doc(jobId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Not found');
      const data = snap.data() as any;
      if (data.status !== 'scheduled' && !(status === 'failed' && data.status === 'failed')) return;
      if (status === 'sent') {
        tx.update(ref, { status: 'sent', sentAt: FieldValue.serverTimestamp(), telegramMessageId });
      } else {
        tx.update(ref, { status: 'failed', lastError: (error || null) });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
