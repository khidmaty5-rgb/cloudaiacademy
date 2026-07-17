import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'cloudaiacademy-journal-visibility-rules-test';
const AUTHOR_ID = 'journal-author';

let testEnv;

function publicDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function userDb(uid, role) {
  return testEnv.authenticatedContext(uid, { role }).firestore();
}

function articleRef(db, articleId) {
  return doc(db, 'journalArticles', articleId);
}

function issueRef(db, issueId = 'issue-1') {
  return doc(db, 'journalIssues', issueId);
}

async function seedJournal({ setting = 'absent' } = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    if (setting === 'missing-field') {
      await setDoc(doc(db, 'settings', 'ui'), { showHero: true });
    } else if (setting !== 'absent') {
      await setDoc(doc(db, 'settings', 'ui'), { showJournalNav: setting });
    }

    await setDoc(articleRef(db, 'published-article'), {
      createdBy: AUTHOR_ID,
      status: 'PUBLISHED',
      title: 'Published article',
    });
    await setDoc(articleRef(db, 'submitted-article'), {
      createdBy: AUTHOR_ID,
      status: 'SUBMITTED',
      title: 'Submitted article',
    });
    await setDoc(issueRef(db), { title: 'Issue 1' });
  });
}

async function assertPublicJournalSucceeds() {
  const db = publicDb();

  await assertSucceeds(getDoc(articleRef(db, 'published-article')));
  await assertSucceeds(getDoc(issueRef(db)));
  await assertSucceeds(
    getDocs(
      query(
        collection(db, 'journalArticles'),
        where('status', '==', 'PUBLISHED'),
      ),
    ),
  );
  await assertSucceeds(getDocs(collection(db, 'journalIssues')));
  await assertFails(getDoc(articleRef(db, 'submitted-article')));
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

describe('Journal visibility rules', () => {
  it('defaults to enabled when settings/ui does not exist', async () => {
    await seedJournal();

    await assertPublicJournalSucceeds();
  });

  it('defaults to enabled when settings/ui has no showJournalNav field', async () => {
    await seedJournal({ setting: 'missing-field' });

    await assertPublicJournalSucceeds();
  });

  it('allows public published-article and issue reads when explicitly enabled', async () => {
    await seedJournal({ setting: true });

    await assertPublicJournalSucceeds();
  });

  it('denies public article and issue reads when explicitly disabled', async () => {
    await seedJournal({ setting: false });
    const db = publicDb();

    await assertFails(getDoc(articleRef(db, 'published-article')));
    await assertFails(getDoc(issueRef(db)));
    await assertFails(
      getDocs(
        query(
          collection(db, 'journalArticles'),
          where('status', '==', 'PUBLISHED'),
        ),
      ),
    );
    await assertFails(getDocs(collection(db, 'journalIssues')));
  });

  it('preserves an author\'s access to their own article when disabled', async () => {
    await seedJournal({ setting: false });
    const db = userDb(AUTHOR_ID, 'student');

    await assertSucceeds(getDoc(articleRef(db, 'submitted-article')));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'journalArticles'),
          where('createdBy', '==', AUTHOR_ID),
        ),
      ),
    );
  });

  it('preserves editor, admin, and teacher access when disabled', async () => {
    await seedJournal({ setting: false });

    for (const role of ['editor', 'admin', 'teacher']) {
      const db = userDb(`${role}-user`, role);
      await assertSucceeds(getDoc(articleRef(db, 'submitted-article')));
      await assertSucceeds(getDocs(collection(db, 'journalArticles')));
      await assertSucceeds(getDoc(issueRef(db)));
      await assertSucceeds(getDocs(collection(db, 'journalIssues')));
    }
  });

  it('does not give reviewers global journal access when disabled', async () => {
    await seedJournal({ setting: false });
    const db = userDb('reviewer-user', 'reviewer');

    await assertFails(getDoc(articleRef(db, 'submitted-article')));
    await assertFails(getDocs(collection(db, 'journalArticles')));
    await assertFails(getDoc(issueRef(db)));
    await assertFails(getDocs(collection(db, 'journalIssues')));
  });
});
