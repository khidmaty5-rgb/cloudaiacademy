import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-journal-reviewer-access-rules-test';
const AUTHOR_ID = 'journal-author';
const REVIEWER_ID = 'assigned-reviewer';

let testEnv;

function articleRef(db, articleId = 'article-1') {
  return doc(db, 'journalArticles', articleId);
}

function article(overrides = {}) {
  return {
    title: 'Article under review',
    abstract: 'Original abstract',
    authors: 'CloudAI QA',
    language: 'en',
    pdfPath: `journal/articles/${AUTHOR_ID}/article-1/manuscript.pdf`,
    status: 'UNDER_REVIEW',
    createdBy: AUTHOR_ID,
    reviewerIds: [REVIEWER_ID],
    reviewerEmails: ['reviewer@example.com'],
    reviewRound: 1,
    manuscriptVersion: 1,
    reviewManuscriptVersion: 1,
    issueId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    acceptedAt: null,
    publishedAt: null,
    ...overrides,
  };
}

async function seedArticle(articleId = 'article-1', overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(articleRef(context.firestore(), articleId), article(overrides));
  });
}

function userDb(uid, role) {
  return testEnv.authenticatedContext(uid, { role }).firestore();
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

describe('Journal reviewer direct Firestore boundaries', () => {
  it('denies an assigned reviewer direct reads of an unpublished article', async () => {
    await seedArticle();
    const reviewerDb = userDb(REVIEWER_ID, 'reviewer');

    await assertFails(getDoc(articleRef(reviewerDb)));
  });

  it('denies an assigned reviewer direct article updates and deletes', async () => {
    await seedArticle();
    const reviewerDb = userDb(REVIEWER_ID, 'reviewer');

    await assertFails(updateDoc(articleRef(reviewerDb), { title: 'Reviewer change' }));
    await assertFails(deleteDoc(articleRef(reviewerDb)));
  });

  it('preserves the author and editorial direct-read boundaries', async () => {
    await seedArticle();

    await assertSucceeds(getDoc(articleRef(userDb(AUTHOR_ID, 'student'))));
    await assertSucceeds(getDoc(articleRef(userDb('editor-user', 'editor'))));
    await assertSucceeds(getDoc(articleRef(userDb('admin-user', 'admin'))));
  });
});
