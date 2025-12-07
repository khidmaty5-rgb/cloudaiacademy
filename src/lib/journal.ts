'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const { firestore } = initializeFirebase();

export type JournalArticleStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'PUBLISHED';

export type JournalArticleInput = {
  title: string;
  abstract: string;
  authors: string;
  language: 'en' | 'ar' | 'both';
  pdfUrl: string;
  codeUrl?: string;
};

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

  await addDoc(articlesRef, {
    ...data,
    status: 'SUBMITTED' as JournalArticleStatus,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    issueId: null,
  });
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

export type JournalIssueInput = {
  id?: string;
  label: string;
  year?: number;
};

export async function createJournalIssue(input: JournalIssueInput) {
  const { id, label, year } = input;
  if (!label) throw new Error('Issue label is required.');

  const issuesRef = collection(firestore, 'journalIssues');

  if (id) {
    const issueRef = doc(issuesRef, id);
    await updateDoc(issueRef, {
      label,
      year: year || null,
      updatedAt: serverTimestamp(),
    }).catch(async () => {
      await updateDoc(issueRef, {
        label,
        year: year || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return;
  }

  await addDoc(issuesRef, {
    label,
    year: year || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

