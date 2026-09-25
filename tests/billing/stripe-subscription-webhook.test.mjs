import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

async function typeScriptModuleUrl(relativePath) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  if (source.includes("'./stripe-subscription-webhook'")) {
    const policyUrl = await typeScriptModuleUrl(
      '../../src/server/stripe-subscription-webhook.ts',
    );
    source = source.replace("'./stripe-subscription-webhook'", JSON.stringify(policyUrl));
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
}

const policy = await import(
  await typeScriptModuleUrl('../../src/server/stripe-subscription-webhook.ts')
);
const store = await import(
  await typeScriptModuleUrl('../../src/server/stripe-subscription-webhook-store.ts')
);

function subscription(overrides = {}) {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    metadata: { firebaseUid: 'learner-1', planId: 'pro', interval: 'month' },
    ...overrides,
  };
}

function syncInput(overrides = {}) {
  return {
    eventId: 'evt_subscription_1',
    eventType: 'customer.subscription.updated',
    eventCreated: 100,
    subscriptionId: 'sub_1',
    ...overrides,
  };
}

function fakeFirestore(initial = {}, options = {}) {
  const documents = new Map(Object.entries(initial));
  const writes = [];
  let failCommits = options.failCommits || 0;
  const db = {
    doc(path) {
      return { path };
    },
    async runTransaction(callback) {
      const staged = [];
      const result = await callback({
        async get(ref) {
          return {
            exists: documents.has(ref.path),
            data: () => documents.get(ref.path),
          };
        },
        set(ref, data, setOptions) {
          staged.push({ path: ref.path, data, options: setOptions });
        },
      });
      if (failCommits > 0) {
        failCommits -= 1;
        throw new Error('simulated commit failure');
      }
      for (const write of staged) {
        const previous = documents.get(write.path) || {};
        documents.set(
          write.path,
          write.options?.merge ? { ...previous, ...write.data } : write.data,
        );
        writes.push(write);
      }
      return result;
    },
  };
  return { db, documents, writes };
}

function dependencies(current, overrides = {}) {
  return {
    loadCurrentSubscription: async () => current,
    findUserIdByCustomerId: async () => null,
    now: () => new Date('2026-09-24T12:00:00Z'),
    ...overrides,
  };
}

describe('Stripe subscription webhook synchronization', () => {
  it('parses the current Stripe subscription and recognizes access states', () => {
    assert.deepEqual(policy.parseStripeSubscriptionSnapshot(subscription()), {
      id: 'sub_1',
      customerId: 'cus_1',
      status: 'active',
      firebaseUid: 'learner-1',
      planId: 'pro',
      interval: 'month',
    });
    assert.equal(policy.stripeSubscriptionGrantsAccess('trialing'), true);
    assert.equal(policy.stripeSubscriptionGrantsAccess('past_due'), false);
  });

  it('atomically records the event, subscription state, and user access', async () => {
    const fake = fakeFirestore({ 'users/learner-1': {} });
    const outcome = await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput(),
      dependencies(subscription()),
    );
    assert.equal(outcome, 'applied');
    assert.deepEqual(
      fake.writes.map((write) => write.path),
      [
        'billingWebhookEvents/evt_subscription_1',
        'stripeSubscriptionStates/sub_1',
        'users/learner-1',
      ],
    );
    assert.equal(fake.documents.get('users/learner-1').requirePayment, false);
    assert.equal(fake.documents.get('users/learner-1').stripeSubscriptionStatus, 'active');
  });

  it('makes an exact event replay a no-fetch and no-write operation', async () => {
    const fake = fakeFirestore({
      'billingWebhookEvents/evt_subscription_1': { outcome: 'applied' },
    });
    let loads = 0;
    const outcome = await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput(),
      dependencies(subscription(), {
        loadCurrentSubscription: async () => {
          loads += 1;
          return subscription();
        },
      }),
    );
    assert.equal(outcome, 'replayed_event');
    assert.equal(loads, 0);
    assert.equal(fake.writes.length, 0);
  });

  it('does not let a delayed older update undo a current cancellation', async () => {
    const fake = fakeFirestore({ 'users/learner-1': {} });
    const canceled = subscription({ status: 'canceled' });
    await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput({
        eventId: 'evt_deleted_newer',
        eventType: 'customer.subscription.deleted',
        eventCreated: 200,
      }),
      dependencies(canceled),
    );
    await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput({ eventId: 'evt_updated_older', eventCreated: 100 }),
      dependencies(canceled),
    );
    assert.equal(fake.documents.get('users/learner-1').requirePayment, true);
    assert.equal(fake.documents.get('users/learner-1').stripeSubscriptionStatus, 'canceled');
  });

  it('converges on current state when distinct events have equal timestamps', async () => {
    const fake = fakeFirestore({ 'users/learner-1': {} });
    await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput({ eventId: 'evt_equal_1', eventCreated: 300 }),
      dependencies(subscription({ status: 'past_due' })),
    );
    await store.syncStripeSubscriptionWebhook(
      fake.db,
      syncInput({ eventId: 'evt_equal_2', eventCreated: 300 }),
      dependencies(subscription({ status: 'active' })),
    );
    assert.equal(fake.documents.get('users/learner-1').requirePayment, false);
    assert.equal(fake.documents.get('users/learner-1').stripeSubscriptionStatus, 'active');
  });

  it('leaves no processed marker after failure so Stripe can retry safely', async () => {
    const fake = fakeFirestore({ 'users/learner-1': {} }, { failCommits: 1 });
    await assert.rejects(
      store.syncStripeSubscriptionWebhook(fake.db, syncInput(), dependencies(subscription())),
      /simulated commit failure/,
    );
    assert.equal(fake.documents.has('billingWebhookEvents/evt_subscription_1'), false);
    assert.equal(
      await store.syncStripeSubscriptionWebhook(
        fake.db,
        syncInput(),
        dependencies(subscription()),
      ),
      'applied',
    );
  });

  it('uses the existing customer binding when subscription metadata has no user', async () => {
    const fake = fakeFirestore({ 'users/learner-1': { stripeCustomerId: 'cus_1' } });
    assert.equal(
      await store.syncStripeSubscriptionWebhook(
        fake.db,
        syncInput(),
        dependencies(subscription({ metadata: { planId: 'pro' } }), {
          findUserIdByCustomerId: async () => 'learner-1',
        }),
      ),
      'applied',
    );
    assert.equal(fake.documents.get('users/learner-1').stripeSubscriptionStatus, 'active');
  });

  it('fails closed on a customer binding conflict and leaves the event retriable', async () => {
    const fake = fakeFirestore({
      'users/learner-1': { stripeCustomerId: 'cus_other', requirePayment: true },
    });
    await assert.rejects(
      store.syncStripeSubscriptionWebhook(
        fake.db,
        syncInput(),
        dependencies(subscription()),
      ),
      /customer binding conflicts/,
    );
    assert.equal(fake.documents.get('users/learner-1').requirePayment, true);
    assert.equal(fake.documents.has('billingWebhookEvents/evt_subscription_1'), false);
  });

  it('keeps an unbound subscription retriable instead of acknowledging it', async () => {
    const fake = fakeFirestore();
    await assert.rejects(
      store.syncStripeSubscriptionWebhook(
        fake.db,
        syncInput(),
        dependencies(subscription({ metadata: {} })),
      ),
      /not bound/,
    );
    assert.equal(fake.documents.has('billingWebhookEvents/evt_subscription_1'), false);
  });
});
