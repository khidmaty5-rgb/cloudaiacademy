import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

async function typeScriptModuleUrl(relativePath) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  if (source.includes("'./course-payment-validation'")) {
    const validationUrl = await typeScriptModuleUrl('../../src/server/course-payment-validation.ts');
    source = source.replace("'./course-payment-validation'", JSON.stringify(validationUrl));
  }
  if (source.includes("'./stripe-course-webhook'")) {
    const webhookUrl = await typeScriptModuleUrl('../../src/server/stripe-course-webhook.ts');
    source = source.replace("'./stripe-course-webhook'", JSON.stringify(webhookUrl));
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
}

const webhook = await import(await typeScriptModuleUrl('../../src/server/stripe-course-webhook.ts'));
const store = await import(await typeScriptModuleUrl('../../src/server/stripe-course-webhook-store.ts'));
const expected = { uid: 'learner-1', courseId: 'course-1', amountCents: 4999, currency: 'USD' };

function session(overrides = {}) {
  return {
    id: 'cs_test_course_1',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 4999,
    currency: 'usd',
    customer: 'cus_1',
    payment_intent: 'pi_1',
    client_reference_id: 'learner-1',
    metadata: { paymentType: 'course', firebaseUid: 'learner-1', courseId: 'course-1' },
    ...overrides,
  };
}

function fakeFirestore(initial = {}) {
  const documents = new Map(Object.entries(initial));
  const writes = [];
  const db = {
    doc(path) {
      return { path };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return {
            exists: documents.has(ref.path),
            data: () => documents.get(ref.path),
          };
        },
        set(ref, data, options) {
          writes.push({ path: ref.path, data, options });
          const previous = documents.get(ref.path) || {};
          documents.set(ref.path, options?.merge ? { ...previous, ...data } : data);
        },
      });
    },
  };
  return { db, documents, writes };
}

function fulfillmentInput(overrides = {}) {
  return {
    eventId: 'evt_course_1',
    eventType: 'checkout.session.completed',
    eventCreated: 123,
    uid: 'learner-1',
    courseId: 'course-1',
    courseTitle: 'Course One',
    sessionId: 'cs_test_course_1',
    customerId: 'cus_1',
    paymentIntentId: 'pi_1',
    amount: 4999,
    currency: 'usd',
    ...overrides,
  };
}

describe('Stripe course webhook policy', () => {
  it('fulfills a paid completed event', () => {
    const result = webhook.classifyStripeCourseWebhook('checkout.session.completed', session(), expected);
    assert.equal(result.action, 'fulfill');
    assert.equal(result.sessionId, 'cs_test_course_1');
    assert.equal(result.amount, 4999);
    assert.equal(result.currency, 'usd');
  });

  it('fulfills a delayed asynchronous payment success event', () => {
    assert.equal(
      webhook.classifyStripeCourseWebhook(
        'checkout.session.async_payment_succeeded',
        session(),
        expected,
      ).action,
      'fulfill',
    );
  });

  it('ignores checkout completion while payment is still pending', () => {
    const result = webhook.classifyStripeCourseWebhook(
      'checkout.session.completed',
      session({ payment_status: 'unpaid' }),
      expected,
    );
    assert.deepEqual(result.action, 'ignore');
    assert.equal(result.outcome, 'pending_payment');
  });

  it('rejects amount, currency, ownership, course, and payment-type mismatches', () => {
    const invalid = [
      session({ amount_total: 1 }),
      session({ currency: 'cad' }),
      session({ metadata: { paymentType: 'course', firebaseUid: 'other', courseId: 'course-1' } }),
      session({ metadata: { paymentType: 'course', firebaseUid: 'learner-1', courseId: 'other' } }),
      session({ metadata: { firebaseUid: 'learner-1', courseId: 'course-1' } }),
    ];
    for (const value of invalid) {
      assert.notEqual(
        webhook.classifyStripeCourseWebhook('checkout.session.completed', value, expected).action,
        'fulfill',
      );
    }
  });

  it('does not treat non-course sessions as course entitlements', () => {
    assert.equal(
      webhook.classifyStripeCourseWebhook(
        'checkout.session.completed',
        session({ metadata: { firebaseUid: 'learner-1', planId: 'pro' } }),
        expected,
      ).action,
      'not_course',
    );
  });

  it('deduplicates an exact event before any other decision', () => {
    assert.equal(
      webhook.decideStripeCourseFulfillment(
        { ...expected, sessionId: 'cs_test_course_1' },
        { eventProcessed: true },
      ),
      'replayed_event',
    );
  });

  it('rejects reuse of a session bound to another entitlement', () => {
    assert.equal(
      webhook.decideStripeCourseFulfillment(
        { ...expected, sessionId: 'cs_test_course_1' },
        {
          eventProcessed: false,
          sessionBinding: { uid: 'other', courseId: 'course-1' },
        },
      ),
      'session_binding_conflict',
    );
  });

  it('does not overwrite an entitlement on duplicate-session or later-purchase events', () => {
    assert.equal(
      webhook.decideStripeCourseFulfillment(
        { ...expected, sessionId: 'cs_test_course_1' },
        {
          eventProcessed: false,
          sessionBinding: { uid: 'learner-1', courseId: 'course-1' },
          purchase: { status: 'PAID', stripeCheckoutSessionId: 'cs_test_course_1' },
        },
      ),
      'replayed_session',
    );
    assert.equal(
      webhook.decideStripeCourseFulfillment(
        { ...expected, sessionId: 'cs_test_course_1' },
        {
          eventProcessed: false,
          purchase: { status: 'PAID', stripeCheckoutSessionId: 'cs_previous' },
        },
      ),
      'already_entitled',
    );
  });

  it('fulfills only when no replay, conflict, or paid entitlement exists', () => {
    assert.equal(
      webhook.decideStripeCourseFulfillment(
        { ...expected, sessionId: 'cs_test_course_1' },
        { eventProcessed: false },
      ),
      'fulfill',
    );
  });

  it('atomically records the event, session binding, and new entitlement', async () => {
    const fake = fakeFirestore();
    assert.equal(await store.fulfillStripeCourseWebhook(fake.db, fulfillmentInput()), 'fulfill');
    assert.deepEqual(
      fake.writes.map((write) => write.path),
      [
        'billingWebhookEvents/evt_course_1',
        'stripeCourseSessions/cs_test_course_1',
        'users/learner-1/coursePurchases/course-1',
      ],
    );
    assert.equal(
      fake.documents.get('users/learner-1/coursePurchases/course-1').confirmedBy,
      'stripe_webhook',
    );
  });

  it('makes an exact event replay a no-write operation', async () => {
    const fake = fakeFirestore({
      'billingWebhookEvents/evt_course_1': { outcome: 'fulfill' },
    });
    assert.equal(
      await store.fulfillStripeCourseWebhook(fake.db, fulfillmentInput()),
      'replayed_event',
    );
    assert.equal(fake.writes.length, 0);
  });

  it('records a second event for the same session without rewriting paidAt', async () => {
    const originalPaidAt = new Date('2026-01-01T00:00:00Z');
    const fake = fakeFirestore({
      'stripeCourseSessions/cs_test_course_1': { uid: 'learner-1', courseId: 'course-1' },
      'users/learner-1/coursePurchases/course-1': {
        status: 'PAID',
        stripeCheckoutSessionId: 'cs_test_course_1',
        paidAt: originalPaidAt,
      },
    });
    assert.equal(
      await store.fulfillStripeCourseWebhook(
        fake.db,
        fulfillmentInput({ eventId: 'evt_course_2' }),
      ),
      'replayed_session',
    );
    assert.equal(
      fake.writes.some((write) => write.path === 'users/learner-1/coursePurchases/course-1'),
      false,
    );
    assert.equal(
      fake.documents.get('users/learner-1/coursePurchases/course-1').paidAt,
      originalPaidAt,
    );
  });
});
