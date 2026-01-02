import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminApp';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
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
    return initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }), projectId },
      name,
    );
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
        const pk = sa.private_key?.includes('\\n')
          ? sa.private_key.replace(/\\n/g, '\n')
          : sa.private_key;
        console.log('[adminApp] Using local service account at', p, 'projectId:', pId);
        return initializeApp(
          { credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId },
          name,
        );
      }
    } catch {}
  }
  console.log('[adminApp] Using applicationDefault credentials with projectId:', projectId);
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

async function stripePost(pathname: string, params: URLSearchParams) {
  const secret = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error('Stripe secret key is missing (STRIPE_SECRET_KEY).');
  }
  const resp = await fetch(`https://api.stripe.com/v1${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const json: any = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = json?.error?.message || `Stripe API error (${resp.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const uid = decoded.uid || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getFirestore(app);
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};
    const customerId = (userData?.stripeCustomerId || '').trim();
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found for this user.' }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const params = new URLSearchParams();
    params.set('customer', customerId);
    params.set('return_url', `${origin}/dashboard?billing=return`);
    const portal = await stripePost('/billing_portal/sessions', params);
    const url = (portal?.url || '').trim();
    if (!url) return NextResponse.json({ error: 'Stripe did not return a portal URL.' }, { status: 500 });

    return NextResponse.json({ url }, { status: 200 });
  } catch (e: any) {
    console.error('[billing/portal] error', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

