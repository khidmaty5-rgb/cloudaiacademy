import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PAYMENT_SETTINGS,
  getStripePriceId,
  sanitizePaymentSettings,
  type PaymentInterval,
  type PaymentPlanId,
} from '@/lib/payment-settings';

export const runtime = 'nodejs';

type CheckoutRequestBody = {
  planId?: PaymentPlanId;
  interval?: PaymentInterval;
};

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

function normalizeInterval(interval: unknown, fallback: PaymentInterval): PaymentInterval {
  return interval === 'year' || interval === 'month' ? interval : fallback;
}

function normalizePlanId(planId: unknown): PaymentPlanId | null {
  if (planId === 'basic' || planId === 'pro' || planId === 'enterprise') return planId;
  return null;
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

    const role = (decoded as any)?.role as string | undefined | null;
    if (role && role !== 'student') {
      return NextResponse.json({ error: 'Only student accounts can checkout.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutRequestBody;
    const planId = normalizePlanId(body.planId);
    if (!planId) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });

    const db = getFirestore(app);
    const settingsSnap = await db.doc('settings/payment').get();
    const settings = sanitizePaymentSettings(
      settingsSnap.exists ? (settingsSnap.data() as any) : null,
      DEFAULT_PAYMENT_SETTINGS,
    );

    if (!settings.enabled || settings.provider !== 'stripe') {
      return NextResponse.json({ error: 'Payments are not enabled.' }, { status: 400 });
    }

    const interval = normalizeInterval(body.interval, settings.intervals.default);
    const priceId = getStripePriceId(settings, planId, interval);
    if (!priceId) {
      return NextResponse.json({ error: 'Plan is not configured for checkout.' }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};

    const email = (userData?.email || decoded.email || '').trim();
    const existingCustomerId = (userData?.stripeCustomerId || '').trim();

    let customerId = existingCustomerId;
    if (!customerId) {
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      params.set('metadata[firebaseUid]', uid);
      const customer = await stripePost('/customers', params);
      customerId = (customer?.id || '').trim();
      if (customerId) {
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
      }
    }

    const sessionParams = new URLSearchParams();
    sessionParams.set('mode', settings.model === 'one_time' ? 'payment' : 'subscription');
    sessionParams.set('success_url', `${origin}/dashboard?payment=success`);
    sessionParams.set('cancel_url', `${origin}/#pricing`);
    sessionParams.set('client_reference_id', uid);
    sessionParams.set('metadata[firebaseUid]', uid);
    sessionParams.set('metadata[planId]', planId);
    sessionParams.set('metadata[interval]', interval);
    if (customerId) sessionParams.set('customer', customerId);
    else if (email) sessionParams.set('customer_email', email);

    sessionParams.set('line_items[0][price]', priceId);
    sessionParams.set('line_items[0][quantity]', '1');

    if (settings.model !== 'one_time') {
      sessionParams.set('subscription_data[metadata][firebaseUid]', uid);
      sessionParams.set('subscription_data[metadata][planId]', planId);
      sessionParams.set('subscription_data[metadata][interval]', interval);
    }

    const session = await stripePost('/checkout/sessions', sessionParams);
    const url = (session?.url || '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    }
    return NextResponse.json({ url }, { status: 200 });
  } catch (e: any) {
    console.error('[billing/checkout] error', e);
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

