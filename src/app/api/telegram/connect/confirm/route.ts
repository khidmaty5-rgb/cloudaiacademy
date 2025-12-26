import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppTelegramConnectConfirm';
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

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const d = new Date(v); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const secret = (req.headers.get('x-n8n-secret') || req.headers.get('X-N8N-SECRET') || '').trim();
    const expected = (process.env.N8N_WEBHOOK_SECRET || '').trim();
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, chatId, chatType, chatTitle } = await req.json();
    if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    if (!chatId || typeof chatId !== 'string') return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 });
    if (!['group', 'supergroup', 'channel'].includes(chatType)) {
      return NextResponse.json({ error: 'Invalid chatType' }, { status: 400 });
    }

    const app = getAdminApp();
    const db = getFirestore(app);

    const ref = db.collection('tg_connect_requests').doc(code);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Invalid code');
      const data = snap.data() as any;
      if (data.used) throw new Error('Code already used');
      const exp = toMillis(data.expiresAt);
      if (!exp || exp < now) throw new Error('Code expired');
      const providerId = data.providerId as string;
      if (!providerId) throw new Error('Invalid provider');

      const userRef = db.doc(`users/${providerId}`);
      tx.set(userRef, {
        telegram: {
          verified: true,
          chatId,
          chatType,
          chatTitle: chatTitle || null,
          verifiedAt: FieldValue.serverTimestamp(),
        },
      }, { merge: true });

      tx.update(ref, { used: true, usedAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
