import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

type StripeEvent = {
  id: string;
  type: string;
  data: { object: any };
  created?: number;
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

function parseStripeSignature(sigHeader: string) {
  const parts = String(sigHeader || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const timestamp = timestampPart ? timestampPart.slice(2) : '';
  const signatures = parts
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))
    .filter(Boolean);
  return { timestamp, signatures };
}

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyStripeWebhook(payload: string, sigHeader: string) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET.');

  const { timestamp, signatures } = parseStripeSignature(sigHeader);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // 5 minute tolerance
  const now = Math.floor(Date.now() / 1000);
  const toleranceSec = 5 * 60;
  if (Math.abs(now - ts) > toleranceSec) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest();

  return signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      return timingSafeEqual(sigBuf, expected);
    } catch {
      return false;
    }
  });
}

async function findUserIdByCustomerId(db: FirebaseFirestore.Firestore, customerId: string) {
  const cid = (customerId || '').trim();
  if (!cid) return null;
  const snap = await db.collection('users').where('stripeCustomerId', '==', cid).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id || null;
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') || req.headers.get('Stripe-Signature') || '';

  try {
    const ok = verifyStripeWebhook(payload, signature);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[billing/webhook] verify error', e);
    return NextResponse.json({ error: e?.message || 'Invalid signature' }, { status: 400 });
  }

  let event: StripeEvent | null = null;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const obj = event?.data?.object;

    const setRequirePayment = async (uid: string, requirePayment: boolean, extra?: Record<string, any>) => {
      await db.doc(`users/${uid}`).set(
        {
          requirePayment,
          billingStatus: requirePayment ? 'REQUIRES_PAYMENT' : 'ACTIVE',
          billingUpdatedAt: new Date(),
          ...(extra || {}),
        },
        { merge: true },
      );
    };

    // Checkout completed (covers one-time payments and first subscription purchase)
    if (event.type === 'checkout.session.completed') {
      const session = obj || {};
      const uid =
        (session?.metadata?.firebaseUid as string | undefined) ||
        (session?.client_reference_id as string | undefined) ||
        null;
      const customerId = (session?.customer as string | undefined) || '';
      const planId = (session?.metadata?.planId as string | undefined) || '';
      const interval = (session?.metadata?.interval as string | undefined) || '';
      const courseId = (session?.metadata?.courseId as string | undefined) || '';
      const courseTitle = (session?.metadata?.courseTitle as string | undefined) || '';

      let userId = uid;
      if (!userId && customerId) userId = await findUserIdByCustomerId(db, customerId);
      if (userId) {
        if (courseId) {
          await db.doc(`users/${userId}/coursePurchases/${courseId}`).set(
            {
              courseId,
              courseTitle: courseTitle || undefined,
              stripeCustomerId: customerId || undefined,
              stripeCheckoutSessionId: session?.id,
              amount: (session as any)?.amount_total ?? undefined,
              currency: (session as any)?.currency ?? undefined,
              status: 'PAID',
              paidAt: new Date(),
            },
            { merge: true },
          );
        } else {
          await setRequirePayment(userId, false, {
            stripeCustomerId: customerId || undefined,
            stripeCheckoutSessionId: session?.id,
            billingPlanId: planId || undefined,
            billingInterval: interval || undefined,
          });
        }
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Subscription status changes
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = obj || {};
      const customerId = (sub?.customer as string | undefined) || '';
      const status = (sub?.status as string | undefined) || '';
      const uidFromMeta = (sub?.metadata?.firebaseUid as string | undefined) || null;
      const planId = (sub?.metadata?.planId as string | undefined) || '';
      const interval = (sub?.metadata?.interval as string | undefined) || '';

      let userId = uidFromMeta;
      if (!userId && customerId) userId = await findUserIdByCustomerId(db, customerId);

      if (userId) {
        const active = status === 'active' || status === 'trialing';
        await setRequirePayment(userId, !active, {
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: sub?.id,
          stripeSubscriptionStatus: status,
          billingPlanId: planId || undefined,
          billingInterval: interval || undefined,
        });
      }

      return NextResponse.json({ received: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    console.error('[billing/webhook] handler error', e);
    return NextResponse.json({ error: e?.message || 'Webhook handler error' }, { status: 500 });
  }
}
