import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_PAYMENT_SETTINGS, sanitizePaymentSettings } from '@/lib/payment-settings';

export const runtime = 'nodejs';

type CourseCheckoutBody = {
  courseId?: string;
};

function getAdminApp(): App {
  const name = 'adminAppBillingCourseCheckout';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  if (usingEmulators) {
    console.log('[billing/course-checkout] Using emulators with projectId:', projectId);
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  if (projectId && clientEmail && privateKey) {
    console.log('[billing/course-checkout] Using env service account with projectId:', projectId);
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
        const pk = sa.private_key?.includes('\\n') ? sa.private_key.replace(/\\n/g, '\n') : sa.private_key;
        console.log('[billing/course-checkout] Using local service account at', p, 'projectId:', pId);
        return initializeApp(
          { credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId },
          name,
        );
      }
    } catch {}
  }

  console.log('[billing/course-checkout] Using applicationDefault credentials with projectId:', projectId);
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

function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function normalizePriceToCents(price: unknown): number | null {
  if (typeof price === 'number' && Number.isFinite(price)) {
    if (price <= 0) return 0;
    return Math.round(price * 100);
  }

  if (typeof price !== 'string') return null;
  const raw = price.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (lowered === 'free' || lowered === '$0' || lowered === '0' || lowered === '0.00') return 0;

  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  return Math.round(n * 100);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    const uid = decoded.uid || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tokenRoleRaw = (decoded as Record<string, unknown>).role;
    const tokenRole = typeof tokenRoleRaw === 'string' ? tokenRoleRaw : null;
    if (tokenRole && tokenRole !== 'student') {
      return NextResponse.json({ error: 'Only student accounts can checkout.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as CourseCheckoutBody;
    const courseId = (typeof body.courseId === 'string' ? body.courseId : '').trim();
    if (!courseId || !isSafeId(courseId)) {
      return NextResponse.json({ error: 'Invalid course.' }, { status: 400 });
    }

    const db = getFirestore(app);

    const settingsSnap = await db.doc('settings/payment').get();
    const settings = sanitizePaymentSettings(
      settingsSnap.exists ? settingsSnap.data() : null,
      DEFAULT_PAYMENT_SETTINGS,
    );
    if (!settings.enabled) {
      return NextResponse.json(
        { error: 'Payments are disabled. Enable payments in /admin/payment and click Save.' },
        { status: 400 },
      );
    }
    if (settings.provider !== 'stripe') {
      return NextResponse.json(
        { error: `Payments provider is set to \"${settings.provider}\". Set it to \"stripe\".` },
        { status: 400 },
      );
    }
    if (settings.model !== 'per_course') {
      return NextResponse.json(
        { error: `Payments model is set to \"${settings.model}\". Set it to \"per_course\".` },
        { status: 400 },
      );
    }

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};

    const profileRole = String(userData?.role || '').trim().toLowerCase();
    if (profileRole && profileRole !== 'student') {
      return NextResponse.json({ error: 'Only student accounts can checkout.' }, { status: 403 });
    }

    const courseSnap = await db.doc(`courses/${courseId}`).get();
    if (!courseSnap.exists) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    const course = courseSnap.data() as any;

    const cents = normalizePriceToCents(course?.price);
    if (cents == null) {
      return NextResponse.json({ error: 'Course price is not configured.' }, { status: 400 });
    }
    if (cents <= 0) {
      return NextResponse.json({ error: 'This course is free.' }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
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

    const currency = String(settings.currency || 'CAD').toLowerCase();
    const courseTitle = String(course?.title || courseId).trim() || courseId;

    const sessionParams = new URLSearchParams();
    sessionParams.set('mode', 'payment');
    sessionParams.set('success_url', `${origin}/courses/${courseId}?payment=success`);
    sessionParams.set('cancel_url', `${origin}/courses/${courseId}?payment=cancel`);
    sessionParams.set('client_reference_id', uid);
    sessionParams.set('metadata[firebaseUid]', uid);
    sessionParams.set('metadata[courseId]', courseId);
    sessionParams.set('metadata[paymentType]', 'course');
    sessionParams.set('metadata[courseTitle]', courseTitle);
    if (customerId) sessionParams.set('customer', customerId);
    else if (email) sessionParams.set('customer_email', email);

    sessionParams.set('line_items[0][price_data][currency]', currency);
    sessionParams.set('line_items[0][price_data][unit_amount]', String(cents));
    sessionParams.set('line_items[0][price_data][product_data][name]', courseTitle);
    sessionParams.set('line_items[0][quantity]', '1');

    const session = await stripePost('/checkout/sessions', sessionParams);
    const url = (session?.url || '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    }

    return NextResponse.json({ url }, { status: 200 });
  } catch (e: any) {
    console.error('[billing/course-checkout] error', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
