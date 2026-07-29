import { createHash } from 'node:crypto';

import type { DocumentData, Firestore } from 'firebase-admin/firestore';

const ASSIGNMENTS_COLLECTION = 'journalReviewerAssignments';

export type JournalReviewerAssignment = {
  articleId: string;
  reviewerId: string;
  reviewerEmail: string;
  assignedAt?: unknown;
  assignedBy?: string | null;
};

export function journalReviewerAssignmentId(articleId: string, reviewerId: string): string {
  return createHash('sha256')
    .update(JSON.stringify([articleId, reviewerId]))
    .digest('hex');
}

export function journalReviewerAssignmentRef(
  db: Firestore,
  articleId: string,
  reviewerId: string,
) {
  return db
    .collection(ASSIGNMENTS_COLLECTION)
    .doc(journalReviewerAssignmentId(articleId, reviewerId));
}

export async function hasJournalReviewerAssignment(
  db: Firestore,
  articleId: string,
  reviewerId: string,
): Promise<boolean> {
  return (await journalReviewerAssignmentRef(db, articleId, reviewerId).get()).exists;
}

function assignmentFromDocument(document: {
  data(): DocumentData;
}): JournalReviewerAssignment | null {
  const data = document.data();
  if (
    typeof data.articleId !== 'string' ||
    typeof data.reviewerId !== 'string' ||
    typeof data.reviewerEmail !== 'string'
  ) {
    return null;
  }

  return {
    articleId: data.articleId,
    reviewerId: data.reviewerId,
    reviewerEmail: data.reviewerEmail,
    assignedAt: data.assignedAt,
    assignedBy: typeof data.assignedBy === 'string' ? data.assignedBy : null,
  };
}

export async function listJournalReviewerAssignmentsForArticle(
  db: Firestore,
  articleId: string,
): Promise<JournalReviewerAssignment[]> {
  const snapshot = await db
    .collection(ASSIGNMENTS_COLLECTION)
    .where('articleId', '==', articleId)
    .get();

  return snapshot.docs
    .map(assignmentFromDocument)
    .filter((assignment): assignment is JournalReviewerAssignment => assignment !== null);
}

export async function listJournalReviewerAssignmentsForReviewer(
  db: Firestore,
  reviewerId: string,
): Promise<JournalReviewerAssignment[]> {
  const snapshot = await db
    .collection(ASSIGNMENTS_COLLECTION)
    .where('reviewerId', '==', reviewerId)
    .get();

  return snapshot.docs
    .map(assignmentFromDocument)
    .filter((assignment): assignment is JournalReviewerAssignment => assignment !== null);
}

export async function deleteJournalReviewerAssignmentsForArticle(
  db: Firestore,
  articleId: string,
): Promise<number> {
  const snapshot = await db
    .collection(ASSIGNMENTS_COLLECTION)
    .where('articleId', '==', articleId)
    .get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.size;
}
