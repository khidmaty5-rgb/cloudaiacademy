'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { JournalArticle, JournalIssue, JournalArticleStatus } from '@/types/models';

const { firestore } = initializeFirebase();

export type JournalArticleInput = Pick<
  JournalArticle,
  'title' | 'abstract' | 'authors' | 'language' | 'pdfUrl' | 'codeUrl'
>;

export async function submitJournalArticle(
  data: JournalArticleInput,
  createdBy: string,
) {
  if (!createdBy) {
    throw new Error('You must be signed in to submit an article.');
  }
  if (!data.title || !data.abstract || !data.authors || !data.pdfUrl) {
    throw new Error('Title, abstract, authors, and PDF URL are required.');
  }

  const articlesRef = collection(firestore, 'journalArticles');

  const payload: JournalArticle = {
    ...data,
    status: 'SUBMITTED',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    issueId: null,
  };

  await addDoc(articlesRef, payload);
}

export async function updateJournalArticleStatusAndIssue(
  articleId: string,
  status: JournalArticleStatus,
  issueId: string | null,
) {
  if (!articleId) throw new Error('Article ID is required.');
  const ref = doc(firestore, 'journalArticles', articleId);
  await updateDoc(ref, {
    status,
    issueId: issueId || null,
    updatedAt: serverTimestamp(),
  });
}

export type JournalIssueInput = Pick<JournalIssue, 'id' | 'label' | 'year'>;

export async function createJournalIssue(input: JournalIssueInput) {
  const { id, label, year } = input;
  if (!label) throw new Error('Issue label is required.');

  const issuesRef = collection(firestore, 'journalIssues');

  if (id) {
    const issueRef = doc(issuesRef, id);
    await setDoc(issueRef, {
      label,
      year: year || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return;
  }

  await addDoc(issuesRef, {
    label,
    year: year || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies JournalIssue);
}

export type { JournalArticleStatus };
