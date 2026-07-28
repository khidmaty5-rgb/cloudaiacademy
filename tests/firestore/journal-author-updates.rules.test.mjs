import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-journal-author-updates-rules-test';
const AUTHOR_ID = 'journal-author';

let testEnv;

function articleRef(db, articleId = 'article-1') {
  return doc(db, 'journalArticles', articleId);
}

function article(overrides = {}) {
  return {
    title: 'Submitted article',
    abstract: 'Original abstract',
    authors: 'CloudAI QA',
    affiliations: [],
    language: 'en',
    pdfPath: `journal/articles/${AUTHOR_ID}/article-1/manuscript.pdf`,
    pdfUrl: '/api/journal/articles/article-1/download',
    codeUrl: null,
    keywords: [],
    license: 'CC BY 4.0',
    manuscriptVersion: 1,
    manuscripts: [
      {
        version: 1,
        pdfPath: `journal/articles/${AUTHOR_ID}/article-1/manuscript.pdf`,
        uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        uploadedBy: AUTHOR_ID,
        note: '',
      },
    ],
    status: 'SUBMITTED',
    createdBy: AUTHOR_ID,
    createdByEmail: 'author@example.com',
    createdByName: 'Journal Author',
    reviewRound: 0,
    reviewRoundStartedAt: null,
    reviewManuscriptVersion: null,
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

function userDb(uid, role = 'student') {
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

describe('Journal author client update boundaries', () => {
  it('denies direct author metadata updates while submitted', async () => {
    await seedArticle();
    const db = userDb(AUTHOR_ID);

    await assertFails(updateDoc(articleRef(db), { title: 'Changed title' }));
    await assertFails(updateDoc(articleRef(db), { abstract: 'Changed abstract' }));
  });

  it('denies direct author metadata updates while draft', async () => {
    await seedArticle('draft-article', { status: 'DRAFT' });
    const db = userDb(AUTHOR_ID);

    await assertFails(
      updateDoc(articleRef(db, 'draft-article'), { keywords: ['changed'] }),
    );
  });

  it('denies author-controlled workflow fields', async () => {
    await seedArticle();
    const db = userDb(AUTHOR_ID);
    const ref = articleRef(db);

    await assertFails(updateDoc(ref, { reviewerIds: [AUTHOR_ID] }));
    await assertFails(updateDoc(ref, { issueId: 'issue-1' }));
    await assertFails(updateDoc(ref, { reviewRound: 2 }));
    await assertFails(updateDoc(ref, { acceptedAt: new Date() }));
    await assertFails(updateDoc(ref, { publishedAt: new Date() }));
    await assertFails(updateDoc(ref, { status: 'PUBLISHED' }));
  });

  it('denies author changes to ownership and manuscript storage fields', async () => {
    await seedArticle();
    const db = userDb(AUTHOR_ID);
    const ref = articleRef(db);

    await assertFails(updateDoc(ref, { createdBy: 'another-user' }));
    await assertFails(
      updateDoc(ref, {
        pdfPath: `journal/articles/${AUTHOR_ID}/article-1/replacement.pdf`,
      }),
    );
    await assertFails(updateDoc(ref, { manuscriptVersion: 2 }));
    await assertFails(updateDoc(ref, { manuscripts: [] }));
  });

  it('denies direct author deletes to prevent orphaned manuscript files', async () => {
    await seedArticle();
    const db = userDb(AUTHOR_ID);

    await assertFails(deleteDoc(articleRef(db)));
  });

  it('does not grant update or delete access to other users, reviewers, or teachers', async () => {
    await seedArticle();

    for (const [uid, role] of [
      ['other-student', 'student'],
      ['reviewer-user', 'reviewer'],
      ['teacher-user', 'teacher'],
    ]) {
      const db = userDb(uid, role);
      await assertFails(updateDoc(articleRef(db), { title: `${role} change` }));
      await assertFails(deleteDoc(articleRef(db)));
    }
  });

  it('preserves editor and administrator workflow updates and deletes', async () => {
    await seedArticle('editor-article');
    await seedArticle('admin-article');

    const editorDb = userDb('editor-user', 'editor');
    await assertSucceeds(
      updateDoc(articleRef(editorDb, 'editor-article'), {
        status: 'ACCEPTED',
        issueId: 'issue-1',
      }),
    );
    await assertSucceeds(deleteDoc(articleRef(editorDb, 'editor-article')));

    const adminDb = userDb('admin-user', 'admin');
    await assertSucceeds(
      updateDoc(articleRef(adminDb, 'admin-article'), {
        status: 'REJECTED',
      }),
    );
    await assertSucceeds(deleteDoc(articleRef(adminDb, 'admin-article')));
  });
});
