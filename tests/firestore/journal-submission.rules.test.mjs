import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-journal-submission-rules-test';
const AUTHOR_ID = 'journal-author';

let testEnv;

function validSubmission(overrides = {}) {
  return {
    title: 'A test article',
    abstract: 'A focused rules test.',
    authors: 'CloudAI QA',
    language: 'en',
    pdfPath: `journal/articles/${AUTHOR_ID}/article-1/manuscript.pdf`,
    status: 'SUBMITTED',
    createdBy: AUTHOR_ID,
    issueId: null,
    reviewRound: 0,
    reviewRoundStartedAt: null,
    reviewManuscriptVersion: null,
    acceptedAt: null,
    publishedAt: null,
    ...overrides,
  };
}

function articleRef(db, articleId = 'article-1') {
  return doc(db, 'journalArticles', articleId);
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

describe('journal submission creation rules', () => {
  it('allows an author to create a valid submitted article in their PDF namespace', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertSucceeds(setDoc(articleRef(authorDb), validSubmission()));
  });

  it('denies creating an article for another author', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertFails(
      setDoc(articleRef(authorDb), validSubmission({ createdBy: 'another-user' })),
    );
  });

  it('denies a PDF path outside the author namespace or without a PDF extension', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertFails(
      setDoc(
        articleRef(authorDb, 'wrong-owner-path'),
        validSubmission({
          pdfPath: 'journal/articles/another-user/article-1/manuscript.pdf',
        }),
      ),
    );
    await assertFails(
      setDoc(
        articleRef(authorDb, 'wrong-extension'),
        validSubmission({
          pdfPath: `journal/articles/${AUTHOR_ID}/article-1/manuscript.txt`,
        }),
      ),
    );
  });

  it('denies self-publishing or assigning an issue during creation', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertFails(
      setDoc(
        articleRef(authorDb, 'self-published'),
        validSubmission({ status: 'PUBLISHED' }),
      ),
    );
    await assertFails(
      setDoc(
        articleRef(authorDb, 'preassigned-issue'),
        validSubmission({ issueId: 'issue-1' }),
      ),
    );
  });

  it('denies pre-populated publication or review workflow state', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertFails(
      setDoc(
        articleRef(authorDb, 'accepted-at-create'),
        validSubmission({ acceptedAt: new Date('2026-01-01T00:00:00.000Z') }),
      ),
    );
    await assertFails(
      setDoc(
        articleRef(authorDb, 'review-round-at-create'),
        validSubmission({ reviewRound: 2 }),
      ),
    );
  });

  it('denies author-controlled reviewer assignments or unexpected workflow fields', async () => {
    const authorDb = testEnv.authenticatedContext(AUTHOR_ID).firestore();

    await assertFails(
      setDoc(
        articleRef(authorDb, 'self-assigned-reviewer'),
        validSubmission({ reviewerIds: [AUTHOR_ID] }),
      ),
    );
    await assertFails(
      setDoc(
        articleRef(authorDb, 'unexpected-field'),
        validSubmission({ editorDecision: 'ACCEPT' }),
      ),
    );
  });
});
