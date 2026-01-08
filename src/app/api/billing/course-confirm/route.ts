import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

type CourseConfirmBody = {
  courseId?: string;
  sessionId?: string;
  orderId?: string;
};

function getAdminApp(): App {
  const name = 'adminAppBillingCourseConfirm';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  if (usingEmulators) {
    console.log('[billing/course-confirm] Using emulators with projectId:', projectId);
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  if (projectId && clientEmail && privateKey) {
    console.log('[billing/course-confirm] Using env service account with projectId:', projectId);
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
        console.log('[billing/course-confirm] Using local service account at', p, 'projectId:', pId);
        return initializeApp(
          { credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId },
          name,
        );
      }
    } catch {}
  }

  console.log('[billing/course-confirm] Using applicationDefault credentials with projectId:', projectId);
  return initializeApp({ credential: applicationDefault(), projectId }, name);
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

function isPaidSession(session: Record<string, unknown>) {
  const paymentStatus = typeof session.payment_status === 'string' ? session.payment_status : '';
  if (paymentStatus === 'paid') return true;
  if (paymentStatus === 'no_payment_required') return true;
  return false;
}

function paypalApiBase() {
  const env = (process.env.PAYPAL_ENV || '').trim().toLowerCase();
  if (env === 'live' || env === 'production') return 'https://api-m.paypal.com';
  return 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken(): Promise<string> {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET).');
  }

  const resp = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resp.ok) {
    const msg = (json?.error_description as string | undefined) || `PayPal API error (${resp.status})`;
    throw new Error(msg);
  }
  const token = (json?.access_token as string | undefined) || '';
  if (!token) throw new Error('PayPal did not return an access token.');
  return token;
}

function paypalErrorMessage(json: Record<string, unknown> | null, status: number) {
  let msg = `PayPal API error (${status})`;
  const detailsRaw = json?.details;
  if (Array.isArray(detailsRaw) && detailsRaw.length) {
    const first = detailsRaw[0];
    if (first && typeof first === 'object') {
      const desc = (first as Record<string, unknown>).description;
      if (typeof desc === 'string' && desc.trim()) msg = desc;
    }
  }
  const message = json?.message;
  if (typeof message === 'string' && message.trim()) msg = message;
  return msg;
}

async function paypalGetJson(pathname: string) {
  const token = await paypalAccessToken();
  const resp = await fetch(`${paypalApiBase()}${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resp.ok) throw new Error(paypalErrorMessage(json, resp.status));
  return json || {};
}

async function paypalPostJson(pathname: string, body: Record<string, unknown>) {
  const token = await paypalAccessToken();
  const resp = await fetch(`${paypalApiBase()}${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resp.ok) throw new Error(paypalErrorMessage(json, resp.status));
  return json || {};
}

function parsePaypalOrder(order: Record<string, unknown>) {
  const status = pickString(order.status).toUpperCase();
  const purchaseUnitsRaw = order.purchase_units;
  const purchaseUnits = Array.isArray(purchaseUnitsRaw)
    ? purchaseUnitsRaw.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : [];
  const pu = purchaseUnits[0] || null;
  const customId = pu ? pickString(pu.custom_id) : '';

  const amountRaw = pu?.amount;
  const amountObj = amountRaw && typeof amountRaw === 'object' ? (amountRaw as Record<string, unknown>) : {};
  const currency = pickString(amountObj.currency_code).toUpperCase();
  const value = pickString(amountObj.value);

  const payerRaw = order.payer;
  const payerObj = payerRaw && typeof payerRaw === 'object' ? (payerRaw as Record<string, unknown>) : {};
  const payerId = pickString(payerObj.payer_id);
  const payerEmail = pickString(payerObj.email_address);

  // Captures are present after capture
  const paymentsRaw = pu?.payments;
  const paymentsObj = paymentsRaw && typeof paymentsRaw === 'object' ? (paymentsRaw as Record<string, unknown>) : {};
  const capturesRaw = paymentsObj.captures;
  const captures = Array.isArray(capturesRaw)
    ? capturesRaw.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : [];
  const firstCapture = captures[0] || null;
  const captureId = firstCapture ? pickString(firstCapture.id) : '';
  const captureStatus = firstCapture ? pickString(firstCapture.status).toUpperCase() : '';

  return { status, customId, currency, value, payerId, payerEmail, captureId, captureStatus };
}

async function stripeGet(pathname: string, params?: URLSearchParams) {
  const secret = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) throw new Error('Stripe secret key is missing (STRIPE_SECRET_KEY).');

  const url = new URL(`https://api.stripe.com/v1${pathname}`);
  if (params) url.search = params.toString();

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resp.ok) {
    const stripeError = (json?.error as Record<string, unknown> | undefined) || undefined;
    const msg =
      (stripeError && typeof stripeError.message === 'string' && stripeError.message) ||
      `Stripe API error (${resp.status})`;
    throw new Error(msg);
  }
  return json || {};
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function pickMetadata(session: Record<string, unknown>): Record<string, string> {
  const metaRaw = session.metadata;
  if (!metaRaw || typeof metaRaw !== 'object') return {};
  const meta = metaRaw as Record<string, unknown>;
  const out: Record<string, string> = {};
  Object.entries(meta).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

async function findPaidSessionForCourse(opts: {
  courseId: string;
  customerId: string;
  uid: string;
}): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams();
  params.set('customer', opts.customerId);
  params.set('limit', '20');

  const list = await stripeGet('/checkout/sessions', params);
  const dataRaw = (list as Record<string, unknown>).data;
  const data = Array.isArray(dataRaw) ? dataRaw : [];

  const sessions = data.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  const matches = sessions.filter((s) => {
    if (!isPaidSession(s)) return false;
    const meta = pickMetadata(s);
    if (meta.courseId !== opts.courseId) return false;
    if (meta.paymentType && meta.paymentType !== 'course') return false;
    const uidFromMeta = meta.firebaseUid || pickString(s.client_reference_id);
    if (uidFromMeta && uidFromMeta !== opts.uid) return false;
    return true;
  });

  matches.sort((a, b) => {
    const ca = typeof a.created === 'number' ? a.created : 0;
    const cb = typeof b.created === 'number' ? b.created : 0;
    return cb - ca;
  });

  return matches[0] || null;
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

    const body = (await req.json().catch(() => ({}))) as CourseConfirmBody;
    const courseId = (typeof body.courseId === 'string' ? body.courseId : '').trim();
    const sessionId = (typeof body.sessionId === 'string' ? body.sessionId : '').trim();
    const orderId = (typeof body.orderId === 'string' ? body.orderId : '').trim();
    if (!courseId || !isSafeId(courseId)) {
      return NextResponse.json({ error: 'Invalid course.' }, { status: 400 });
    }
    if (sessionId && !isSafeId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 400 });
    }
    if (orderId && !isSafeId(orderId)) {
      return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
    }

    const db = getFirestore(app);
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};

    if (orderId) {
      const courseSnap = await db.doc(`courses/${courseId}`).get();
      if (!courseSnap.exists) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
      const course = courseSnap.data() as Record<string, unknown>;
      const cents = normalizePriceToCents(course?.price);
      if (cents == null) return NextResponse.json({ error: 'Course price is not configured.' }, { status: 400 });
      if (cents <= 0) return NextResponse.json({ error: 'This course is free.' }, { status: 400 });

      const expectedAmount = (cents / 100).toFixed(2);

      const order = await paypalGetJson(`/v2/checkout/orders/${orderId}`);
      let parsed = parsePaypalOrder(order);

      const expectedCustomId = `${uid}:${courseId}`;
      if (!parsed.customId || parsed.customId !== expectedCustomId) {
        return NextResponse.json({ error: 'PayPal order does not match this user/course.' }, { status: 403 });
      }
      if (!parsed.value || parsed.value !== expectedAmount) {
        return NextResponse.json({ error: 'PayPal amount does not match course price.' }, { status: 400 });
      }

      if (parsed.status === 'APPROVED') {
        try {
          const captured = await paypalPostJson(`/v2/checkout/orders/${orderId}/capture`, {});
          parsed = parsePaypalOrder(captured);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Could not capture PayPal order.';
          // If it was already captured, fetching again will show COMPLETED.
          if (!message.toLowerCase().includes('already')) {
            return NextResponse.json({ error: message }, { status: 500 });
          }
          const after = await paypalGetJson(`/v2/checkout/orders/${orderId}`);
          parsed = parsePaypalOrder(after);
        }
      }

      if (parsed.status !== 'COMPLETED') {
        return NextResponse.json({ error: `PayPal order is not completed (status=${parsed.status}).` }, { status: 400 });
      }

      await db.doc(`users/${uid}/coursePurchases/${courseId}`).set(
        {
          courseId,
          courseTitle: pickString(course?.title) || undefined,
          paypalOrderId: orderId,
          paypalCaptureId: parsed.captureId || undefined,
          paypalPayerId: parsed.payerId || undefined,
          paypalPayerEmail: parsed.payerEmail || undefined,
          amount: cents,
          currency: parsed.currency || undefined,
          status: 'PAID',
          paidAt: new Date(),
          confirmedAt: new Date(),
          confirmedBy: 'paypal',
        },
        { merge: true },
      );

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const customerId = pickString(userData?.stripeCustomerId);

    let session: Record<string, unknown> | null = null;
    if (sessionId) {
      session = (await stripeGet(`/checkout/sessions/${sessionId}`)) as Record<string, unknown>;
    } else if (customerId) {
      session = await findPaidSessionForCourse({ courseId, customerId, uid });
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Could not find a paid checkout session for this course.' },
        { status: 404 },
      );
    }

    if (!isPaidSession(session)) {
      return NextResponse.json({ error: 'Checkout session is not paid yet.' }, { status: 400 });
    }

    const metadata = pickMetadata(session);
    if (metadata.paymentType && metadata.paymentType !== 'course') {
      return NextResponse.json({ error: 'This checkout session is not for a course purchase.' }, { status: 400 });
    }
    if (metadata.courseId && metadata.courseId !== courseId) {
      return NextResponse.json({ error: 'Checkout session does not match this course.' }, { status: 400 });
    }
    const uidFromSession = metadata.firebaseUid || pickString(session.client_reference_id);
    if (uidFromSession && uidFromSession !== uid) {
      return NextResponse.json({ error: 'Checkout session does not match this user.' }, { status: 403 });
    }

    const stripeCustomerId = pickString(session.customer) || customerId || undefined;
    const stripeCheckoutSessionId = pickString(session.id) || undefined;
    const amount = typeof session.amount_total === 'number' ? session.amount_total : undefined;
    const currency = pickString(session.currency) || undefined;
    const paymentIntent = pickString(session.payment_intent) || undefined;

    await db.doc(`users/${uid}/coursePurchases/${courseId}`).set(
      {
        courseId,
        courseTitle: metadata.courseTitle || undefined,
        stripeCustomerId,
        stripeCheckoutSessionId,
        stripePaymentIntentId: paymentIntent,
        amount,
        currency,
        status: 'PAID',
        paidAt: new Date(),
        confirmedAt: new Date(),
        confirmedBy: 'return',
      },
      { merge: true },
    );

    if (stripeCustomerId && pickString(userData?.stripeCustomerId) !== stripeCustomerId) {
      await userRef.set({ stripeCustomerId }, { merge: true });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[billing/course-confirm] error', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
