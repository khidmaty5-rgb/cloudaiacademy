import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-profile-rules-test';
const OWNER_ID = 'profile-owner';
const OWNER_EMAIL = 'profile-owner@example.com';

let testEnv;

async function seedProfile(userId, email, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', userId), {
      id: userId,
      email,
      firstName: 'Student',
      lastName: '',
      role: 'student',
      dateJoined: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe('user profile rules', () => {
  it('allows an owner to update names when optional sensitive fields are absent', async () => {
    await seedProfile(OWNER_ID, OWNER_EMAIL);
    const ownerDb = testEnv.authenticatedContext(OWNER_ID, { email: OWNER_EMAIL }).firestore();

    await assertSucceeds(
      updateDoc(doc(ownerDb, 'users', OWNER_ID), {
        firstName: 'CloudAI',
        lastName: 'QA Test',
        role: 'student',
      }),
    );
  });

  it('denies an owner changing their role', async () => {
    await seedProfile(OWNER_ID, OWNER_EMAIL);
    const ownerDb = testEnv.authenticatedContext(OWNER_ID, { email: OWNER_EMAIL }).firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users', OWNER_ID), { role: 'admin' }));
  });

  it('denies an owner adding or changing payment controls', async () => {
    await seedProfile(OWNER_ID, OWNER_EMAIL);
    const ownerDb = testEnv.authenticatedContext(OWNER_ID, { email: OWNER_EMAIL }).firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users', OWNER_ID), { requirePayment: false }));
  });

  it('denies updating another user profile', async () => {
    await seedProfile(OWNER_ID, OWNER_EMAIL);
    const otherDb = testEnv.authenticatedContext('other-user', {
      email: 'other-user@example.com',
      role: 'student',
    }).firestore();

    await assertFails(
      updateDoc(doc(otherDb, 'users', OWNER_ID), {
        firstName: 'Changed',
        lastName: 'By Other',
      }),
    );
  });
});
