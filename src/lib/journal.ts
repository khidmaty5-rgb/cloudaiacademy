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
  'title' | 'abstract' | 'authors' | 'language' | 'codeUrl'
> & {
  affiliations?: string[];
  keywords?: string[];
  license?: string;
  pdfPath: string;
};

export async function submitJournalArticle(
  data: JournalArticleInput,
  createdBy: string,
) {
  if (!createdBy) {
    throw new Error('You must be signed in to submit an article.');
  }
  if (!data.title || !data.abstract || !data.authors || !data.pdfPath) {
    throw new Error('Title, abstract, authors, and PDF are required.');
  }
  const langValid = data.language === 'en' || data.language === 'ar' || data.language === 'both';
  if (!langValid) throw new Error('Invalid language.');

  const articlesRef = collection(firestore, 'journalArticles');

  const payload: JournalArticle = {
    title: data.title,
    abstract: data.abstract,
    authors: data.authors,
    affiliations: data.affiliations || [],
    language: (data.language === 'both' ? 'en' : data.language) as any,
    pdfPath: data.pdfPath,
    codeUrl: data.codeUrl,
    keywords: data.keywords || [],
    license: data.license || 'CC BY 4.0',
    status: 'SUBMITTED',
    createdBy,
    issueId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    acceptedAt: null,
    publishedAt: null,
  } as JournalArticle;

  await addDoc(articlesRef, payload);
}

export async function updateJournalArticleStatusAndIssue(
  articleId: string,
  status: JournalArticleStatus,
  issueId: string | null,
) {
  if (!articleId) throw new Error('Article ID is required.');
  const ref = doc(firestore, 'journalArticles', articleId);
  const update: Record<string, any> = {
    status,
    issueId: issueId || null,
    updatedAt: serverTimestamp(),
  };
  if (status === 'PUBLISHED') {
    update.publishedAt = serverTimestamp();
    update.acceptedAt = serverTimestamp();
  } else if (status === 'ACCEPTED') {
    update.acceptedAt = serverTimestamp();
    update.publishedAt = null;
  } else {
    update.acceptedAt = null;
    update.publishedAt = null;
  }
  await updateDoc(ref, update);
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
