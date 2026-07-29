import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-reviewer-learning-rules-test';
const REVIEWER_ID = 'reviewer-learner';
const COURSE_ID = 'paid-course';

let testEnv;

function reviewerDb() {
  return testEnv.authenticatedContext(REVIEWER_ID, { role: 'reviewer' }).firestore();
}

async function seed({ enrolled = false, purchased = false } = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'settings', 'payment'), {
      paywall: { enabled: true, defaultRequirePayment: true },
    });
    await setDoc(doc(db, 'users', REVIEWER_ID), {
      id: REVIEWER_ID,
      email: 'reviewer@example.com',
      role: 'reviewer',
    });
    await setDoc(doc(db, 'courses', COURSE_ID), {
      title: 'Paid course',
      price: 100,
      status: 'PUBLISHED',
      ownerId: 'teacher-1',
      instructorIds: ['teacher-1'],
      isFull: false,
    });
    await setDoc(doc(db, 'courses', COURSE_ID, 'lessons', 'lesson-1'), {
      title: 'Private lesson',
    });
    if (enrolled) {
      await setDoc(doc(db, 'users', REVIEWER_ID, 'enrollments', COURSE_ID), {
        userId: REVIEWER_ID,
        courseId: COURSE_ID,
        progress: 0,
        completedLessons: [],
      });
    }
    if (purchased) {
      await setDoc(doc(db, 'users', REVIEWER_ID, 'coursePurchases', COURSE_ID), {
        status: 'PAID',
      });
    }
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

describe('reviewer non-Journal learning boundaries', () => {
  it('allows a reviewer to enroll as a learner', async () => {
    await seed();
    const db = reviewerDb();

    await assertSucceeds(
      setDoc(doc(db, 'users', REVIEWER_ID, 'enrollments', COURSE_ID), {
        userId: REVIEWER_ID,
        courseId: COURSE_ID,
        progress: 0,
        completedLessons: [],
      }),
    );
  });

  it('does not give a reviewer staff paywall bypass', async () => {
    await seed({ enrolled: true });
    await assertFails(
      getDoc(doc(reviewerDb(), 'courses', COURSE_ID, 'lessons', 'lesson-1')),
    );
  });

  it('allows an enrolled reviewer to access a purchased course', async () => {
    await seed({ enrolled: true, purchased: true });
    await assertSucceeds(
      getDoc(doc(reviewerDb(), 'courses', COURSE_ID, 'lessons', 'lesson-1')),
    );
  });

  it('allows a reviewer with a purchase to update learning progress', async () => {
    await seed({ enrolled: true, purchased: true });
    await assertSucceeds(
      updateDoc(doc(reviewerDb(), 'users', REVIEWER_ID, 'enrollments', COURSE_ID), {
        progress: 50,
        completedLessons: ['lesson-1'],
      }),
    );
  });

  it('does not give a reviewer course-management privileges', async () => {
    await seed();
    await assertFails(
      updateDoc(doc(reviewerDb(), 'courses', COURSE_ID), { title: 'Reviewer edit' }),
    );
  });
});
