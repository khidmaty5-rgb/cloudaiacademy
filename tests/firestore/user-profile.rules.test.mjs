import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

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
  it('blocks direct admin role writes/deletion but preserves ordinary admin payment controls', async () => {
    await seedProfile('administrator','admin@example.com',{role:'admin'});
    await seedProfile(OWNER_ID,OWNER_EMAIL);
    const db=testEnv.authenticatedContext('administrator',{role:'admin'}).firestore();
    await assertFails(updateDoc(doc(db,'users',OWNER_ID),{role:'teacher'}));
    await assertFails(deleteDoc(doc(db,'users','administrator')));
    await assertFails(deleteDoc(doc(db,'users',OWNER_ID)));
    await assertSucceeds(updateDoc(doc(db,'users',OWNER_ID),{requirePayment:true}));
  });
  it('blocks demoted profile deletion that could revive stale admin claims', async () => {
    await seedProfile(OWNER_ID,OWNER_EMAIL,{role:'student'});
    const db=testEnv.authenticatedContext(OWNER_ID,{email:OWNER_EMAIL,role:'admin'}).firestore();
    await assertFails(deleteDoc(doc(db,'users',OWNER_ID)));
  });
  it('audit records are server-written and readable only by current admins', async () => {
    await seedProfile('administrator','admin@example.com',{role:'admin'});
    await seedProfile(OWNER_ID,OWNER_EMAIL);
    await testEnv.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'roleChangeAudit','event'),{targetUid:OWNER_ID}));
    for (const uid of [OWNER_ID,'administrator']) {
      const db=testEnv.authenticatedContext(uid,{role:uid==='administrator'?'admin':'student'}).firestore();
      await assertFails(setDoc(doc(db,'roleChangeAudit','new'),{newRole:'admin'}));
      await assertFails(updateDoc(doc(db,'roleChangeAudit','event'),{newRole:'admin'}));
      await assertFails(deleteDoc(doc(db,'roleChangeAudit','event')));
      await assertFails(setDoc(doc(db,'securityState','adminRoleChanges'),{version:0}));
    }
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('administrator').firestore(),'roleChangeAudit','event')));
    await assertFails(getDoc(doc(testEnv.authenticatedContext(OWNER_ID).firestore(),'roleChangeAudit','event')));
  });
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
