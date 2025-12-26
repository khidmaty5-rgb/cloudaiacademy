import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppN8nTelegramDue';
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

export async function GET(req: NextRequest) {
  try {
    const secret = (req.headers.get('x-n8n-secret') || req.headers.get('X-N8N-SECRET') || '').trim();
    const expected = (process.env.N8N_WEBHOOK_SECRET || '').trim();
    if (!expected || secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limitStr = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 100);

    const app = getAdminApp();
    const db = getFirestore(app);
    const now = new Date();

    const querySnap = await db
      .collection('tg_jobs')
      .where('status', '==', 'scheduled')
      .where('claimed', '==', false)
      .where('sendAt', '<=', now)
      .orderBy('sendAt', 'asc')
      .limit(limit)
      .get();

    const claimed: any[] = [];
    for (const d of querySnap.docs) {
      const ref = d.ref;
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const data = snap.data() as any;
          if (!data || data.status !== 'scheduled' || data.claimed) return;
          tx.update(ref, { claimed: true, claimedAt: FieldValue.serverTimestamp() });
          claimed.push({ id: snap.id, ...(data as any) });
        });
      } catch {}
    }

    const jobs = claimed.map((j) => ({
      jobId: j.id,
      providerId: j.providerId,
      chatId: j.chatId,
      payload: j.payload,
    }));

    return NextResponse.json({ ok: true, jobs }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
