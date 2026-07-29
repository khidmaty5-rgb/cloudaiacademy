import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import ts from 'typescript';

const source = await readFile(
  new URL('../../src/server/journal-reviewer-assignments.ts', import.meta.url),
  'utf8',
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const store = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);

function firestore(assignments = []) {
  const documents = new Map(
    assignments.map((assignment) => [
      store.journalReviewerAssignmentId(assignment.articleId, assignment.reviewerId),
      assignment,
    ]),
  );

  return {
    batch() {
      const pendingDeletes = [];
      return {
        delete(ref) {
          pendingDeletes.push(ref.id);
        },
        async commit() {
          pendingDeletes.forEach((id) => documents.delete(id));
        },
      };
    },
    collection(name) {
      assert.equal(name, 'journalReviewerAssignments');
      return {
        doc(id) {
          return {
            id,
            async get() {
              const data = documents.get(id);
              return { exists: !!data, data: () => data };
            },
          };
        },
        where(field, operator, value) {
          assert.equal(operator, '==');
          return {
            async get() {
              return {
                docs: [...documents.entries()]
                  .filter(([, assignment]) => assignment[field] === value)
                  .map(([id, assignment]) => ({
                    ref: { id },
                    data: () => assignment,
                  })),
                empty: ![...documents.values()].some(
                  (assignment) => assignment[field] === value,
                ),
                size: [...documents.values()].filter(
                  (assignment) => assignment[field] === value,
                ).length,
              };
            },
          };
        },
      };
    },
  };
}

describe('private Journal reviewer assignment store', () => {
  it('uses a deterministic opaque document id', () => {
    const first = store.journalReviewerAssignmentId('article-1', 'reviewer-1');
    const second = store.journalReviewerAssignmentId('article-1', 'reviewer-1');

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(first, /article|reviewer/);
  });

  it('checks assignment membership using the private deterministic document', async () => {
    const db = firestore([
      {
        articleId: 'article-1',
        reviewerId: 'reviewer-1',
        reviewerEmail: 'reviewer@example.com',
      },
    ]);

    assert.equal(
      await store.hasJournalReviewerAssignment(db, 'article-1', 'reviewer-1'),
      true,
    );
    assert.equal(
      await store.hasJournalReviewerAssignment(db, 'article-1', 'reviewer-2'),
      false,
    );
  });

  it('lists only assignments for the requested article', async () => {
    const db = firestore([
      {
        articleId: 'article-1',
        reviewerId: 'reviewer-1',
        reviewerEmail: 'one@example.com',
      },
      {
        articleId: 'article-2',
        reviewerId: 'reviewer-2',
        reviewerEmail: 'two@example.com',
      },
    ]);

    const assignments = await store.listJournalReviewerAssignmentsForArticle(
      db,
      'article-1',
    );
    assert.deepEqual(
      assignments.map(({ articleId, reviewerId, reviewerEmail }) => ({
        articleId,
        reviewerId,
        reviewerEmail,
      })),
      [
        {
          articleId: 'article-1',
          reviewerId: 'reviewer-1',
          reviewerEmail: 'one@example.com',
        },
      ],
    );
  });

  it('lists only assignments for the current reviewer', async () => {
    const db = firestore([
      {
        articleId: 'article-1',
        reviewerId: 'reviewer-1',
        reviewerEmail: 'one@example.com',
      },
      {
        articleId: 'article-2',
        reviewerId: 'reviewer-2',
        reviewerEmail: 'two@example.com',
      },
    ]);

    const assignments = await store.listJournalReviewerAssignmentsForReviewer(
      db,
      'reviewer-2',
    );
    assert.deepEqual(
      assignments.map((assignment) => assignment.articleId),
      ['article-2'],
    );
  });

  it('deletes every private assignment when an article is deleted', async () => {
    const db = firestore([
      {
        articleId: 'article-1',
        reviewerId: 'reviewer-1',
        reviewerEmail: 'one@example.com',
      },
      {
        articleId: 'article-1',
        reviewerId: 'reviewer-2',
        reviewerEmail: 'two@example.com',
      },
    ]);

    assert.equal(
      await store.deleteJournalReviewerAssignmentsForArticle(db, 'article-1'),
      2,
    );
    assert.deepEqual(
      await store.listJournalReviewerAssignmentsForArticle(db, 'article-1'),
      [],
    );
  });
});
