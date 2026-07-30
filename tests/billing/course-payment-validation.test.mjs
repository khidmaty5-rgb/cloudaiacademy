import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import ts from 'typescript';

const source = await readFile(
  new URL('../../src/server/course-payment-validation.ts', import.meta.url),
  'utf8',
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const validation = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);

const expected = {
  uid: 'learner-1',
  courseId: 'course-1',
  amountCents: 4999,
  currency: 'USD',
};

function stripeSession(overrides = {}) {
  return {
    id: 'cs_test_valid',
    payment_status: 'paid',
    status: 'complete',
    mode: 'payment',
    amount_total: 4999,
    currency: 'usd',
    client_reference_id: 'learner-1',
    metadata: {
      firebaseUid: 'learner-1',
      courseId: 'course-1',
      paymentType: 'course',
    },
    ...overrides,
  };
}

function paypalPayment(overrides = {}) {
  return {
    status: 'COMPLETED',
    customId: 'learner-1:course-1',
    currency: 'USD',
    value: '49.99',
    captureId: 'capture-1',
    captureStatus: 'COMPLETED',
    ...overrides,
  };
}

describe('course payment validation', () => {
  it('accepts the same exact paid Stripe course session consistently', () => {
    const session = stripeSession();
    assert.deepEqual(validation.validateStripeCourseSession(session, expected), { ok: true });
    assert.deepEqual(validation.validateStripeCourseSession(session, expected), { ok: true });
  });

  it('rejects unpaid and no-payment-required Stripe sessions', () => {
    assert.equal(
      validation.validateStripeCourseSession(
        stripeSession({ payment_status: 'unpaid' }),
        expected,
      ).ok,
      false,
    );
    assert.equal(
      validation.validateStripeCourseSession(
        stripeSession({ payment_status: 'no_payment_required' }),
        expected,
      ).ok,
      false,
    );
  });

  it('rejects incomplete or subscription Stripe sessions', () => {
    assert.equal(
      validation.validateStripeCourseSession(stripeSession({ status: 'open' }), expected).ok,
      false,
    );
    assert.equal(
      validation.validateStripeCourseSession(stripeSession({ mode: 'subscription' }), expected).ok,
      false,
    );
  });

  it('requires exact course payment metadata', () => {
    for (const metadata of [
      { firebaseUid: 'learner-1', courseId: 'course-1' },
      { firebaseUid: 'learner-1', paymentType: 'course' },
      { courseId: 'course-1', paymentType: 'course' },
      { firebaseUid: 'learner-1', courseId: 'other-course', paymentType: 'course' },
    ]) {
      assert.equal(
        validation.validateStripeCourseSession(stripeSession({ metadata }), expected).ok,
        false,
      );
    }
  });

  it('rejects either user binding when it conflicts', () => {
    assert.equal(
      validation.validateStripeCourseSession(
        stripeSession({
          metadata: {
            firebaseUid: 'other-user',
            courseId: 'course-1',
            paymentType: 'course',
          },
        }),
        expected,
      ).ok,
      false,
    );
    assert.equal(
      validation.validateStripeCourseSession(
        stripeSession({ client_reference_id: 'other-user' }),
        expected,
      ).ok,
      false,
    );
  });

  it('rejects incorrect or missing Stripe amount and currency', () => {
    for (const overrides of [
      { amount_total: 1 },
      { amount_total: undefined },
      { currency: 'cad' },
      { currency: undefined },
    ]) {
      assert.equal(
        validation.validateStripeCourseSession(stripeSession(overrides), expected).ok,
        false,
      );
    }
  });

  it('requires a Stripe transaction ID', () => {
    assert.equal(
      validation.validateStripeCourseSession(stripeSession({ id: undefined }), expected).ok,
      false,
    );
  });

  it('accepts only exact completed PayPal captures', () => {
    assert.deepEqual(validation.validatePaypalCoursePayment(paypalPayment(), expected), { ok: true });
    for (const overrides of [
      { customId: 'other-user:course-1' },
      { customId: 'learner-1:other-course' },
      { status: 'APPROVED' },
      { captureId: '' },
      { captureStatus: 'PENDING' },
      { value: '0.01' },
      { currency: 'CAD' },
    ]) {
      assert.equal(
        validation.validatePaypalCoursePayment(paypalPayment(overrides), expected).ok,
        false,
      );
    }
  });

  it('normalizes configured course prices to cents', () => {
    assert.equal(validation.normalizePriceToCents(49.99), 4999);
    assert.equal(validation.normalizePriceToCents('$49.99'), 4999);
    assert.equal(validation.normalizePriceToCents('free'), 0);
    assert.equal(validation.normalizePriceToCents('not configured'), null);
  });
});
