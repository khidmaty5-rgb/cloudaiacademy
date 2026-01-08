import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

type PaypalWebhookEvent = Record<string, unknown> & {
  id?: string;
  event_type?: string;
  resource?: unknown;
};

function getAdminApp(): App {
  const name = 'adminAppBillingPayPalWebhook';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  if (usingEmulators) {
    console.log('[billing/paypal-webhook] Using emulators with projectId:', projectId);
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : undefined;
  if (projectId && clientEmail && privateKey) {
    console.log('[billing/paypal-webhook] Using env service account with projectId:', projectId);
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
        console.log('[billing/paypal-webhook] Using local service account at', p, 'projectId:', pId);
        return initializeApp(
          { credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }), projectId: pId },
          name,
        );
      }
    } catch {}
  }

  console.log('[billing/paypal-webhook] Using applicationDefault credentials with projectId:', projectId);
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
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

async function verifyPaypalWebhookSignature(req: NextRequest, event: Record<string, unknown>) {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!webhookId) throw new Error('Missing PAYPAL_WEBHOOK_ID.');

  const transmissionId = pickString(req.headers.get('paypal-transmission-id'));
  const transmissionTime = pickString(req.headers.get('paypal-transmission-time'));
  const certUrl = pickString(req.headers.get('paypal-cert-url'));
  const authAlgo = pickString(req.headers.get('paypal-auth-algo'));
  const transmissionSig = pickString(req.headers.get('paypal-transmission-sig'));

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('Missing PayPal webhook headers.');
  }

  const result = await paypalPostJson('/v1/notifications/verify-webhook-signature', {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: event,
  });

  const status = pickString(result.verification_status).toUpperCase();
  return status === 'SUCCESS';
}

function extractOrderId(event: PaypalWebhookEvent) {
  const eventType = pickString(event.event_type).toUpperCase();
  const resource = (event.resource && typeof event.resource === 'object'
    ? (event.resource as Record<string, unknown>)
    : null) as Record<string, unknown> | null;

  if (eventType.startsWith('CHECKOUT.ORDER.')) {
    const id = pickString(resource?.id);
    return id || null;
  }

  const relatedIds = resource?.supplementary_data;
  if (relatedIds && typeof relatedIds === 'object') {
    const orderId = pickString((relatedIds as any)?.related_ids?.order_id);
    if (orderId) return orderId;
  }

  return null;
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

function parseCustomId(customId: string) {
  const raw = (customId || '').trim();
  if (!raw) return null;
  const idx = raw.lastIndexOf(':');
  if (idx <= 0) return null;
  const uid = raw.slice(0, idx);
  const courseId = raw.slice(idx + 1);
  if (!uid || uid.includes('/')) return null;
  if (!courseId || !isSafeId(courseId)) return null;
  return { uid, courseId };
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  let event: PaypalWebhookEvent;
  try {
    event = JSON.parse(payload) as PaypalWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const ok = await verifyPaypalWebhookSignature(req, event);
    if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid signature';
    console.error('[billing/paypal-webhook] verify error', e);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const orderId = extractOrderId(event);
    if (!orderId) return NextResponse.json({ received: true }, { status: 200 });

    let order = (await paypalGetJson(`/v2/checkout/orders/${orderId}`)) as Record<string, unknown>;
    let parsed = parsePaypalOrder(order);

    if (parsed.status === 'APPROVED') {
      try {
        const captured = await paypalPostJson(`/v2/checkout/orders/${orderId}/capture`, {});
        order = captured;
        parsed = parsePaypalOrder(order);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Could not capture PayPal order.';
        if (!message.toLowerCase().includes('already')) throw e;
        order = (await paypalGetJson(`/v2/checkout/orders/${orderId}`)) as Record<string, unknown>;
        parsed = parsePaypalOrder(order);
      }
    }

    if (parsed.status !== 'COMPLETED') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const ids = parseCustomId(parsed.customId);
    if (!ids) return NextResponse.json({ received: true }, { status: 200 });

    const app = getAdminApp();
    const db = getFirestore(app);

    const courseSnap = await db.doc(`courses/${ids.courseId}`).get();
    if (!courseSnap.exists) return NextResponse.json({ received: true }, { status: 200 });
    const course = courseSnap.data() as Record<string, unknown>;

    const cents = normalizePriceToCents(course?.price);
    if (cents == null || cents <= 0) return NextResponse.json({ received: true }, { status: 200 });
    const expectedAmount = (cents / 100).toFixed(2);
    if (!parsed.value || parsed.value !== expectedAmount) {
      console.warn('[billing/paypal-webhook] amount mismatch', {
        orderId,
        expectedAmount,
        actual: parsed.value,
        courseId: ids.courseId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await db.doc(`users/${ids.uid}/coursePurchases/${ids.courseId}`).set(
      {
        courseId: ids.courseId,
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
        confirmedBy: 'paypal_webhook',
      },
      { merge: true },
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: unknown) {
    console.error('[billing/paypal-webhook] handler error', e);
    const message = e instanceof Error ? e.message : 'Webhook handler error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

