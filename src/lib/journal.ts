'use client';

import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  runTransaction,
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
    manuscriptVersion: 1,
    manuscripts: [
      {
        version: 1,
        pdfPath: data.pdfPath,
        uploadedAt: serverTimestamp() as any,
        uploadedBy: createdBy,
        note: '',
      },
    ],
    status: 'SUBMITTED',
    createdBy,
    issueId: null,
    reviewRound: 0,
    reviewRoundStartedAt: null,
    reviewManuscriptVersion: null,
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

  await runTransaction(firestore as any, async (tx) => {
    const snap = await tx.get(ref as any);
    if (!snap.exists()) throw new Error('Article not found.');
    const current = snap.data() as any;
    const prevStatus = current?.status as string | undefined;

    const update: Record<string, any> = {
      status,
      issueId: issueId || null,
      updatedAt: serverTimestamp(),
    };

    if (status === 'PUBLISHED') {
      update.publishedAt = serverTimestamp();
      if (!current?.acceptedAt) {
        update.acceptedAt = serverTimestamp();
      }
    } else if (status === 'ACCEPTED') {
      update.publishedAt = null;
      if (!current?.acceptedAt) {
        update.acceptedAt = serverTimestamp();
      }
    } else {
      update.acceptedAt = null;
      update.publishedAt = null;
    }

    const enteringUnderReview = status === 'UNDER_REVIEW' && prevStatus !== 'UNDER_REVIEW';
    if (enteringUnderReview) {
      const currentRound = Number(current?.reviewRound);
      const baseRound = Number.isFinite(currentRound) && currentRound >= 0 ? currentRound : 0;
      const nextRound = baseRound + 1;
      const mv = Number(current?.manuscriptVersion);
      const manuscriptVersion = Number.isFinite(mv) && mv > 0 ? mv : 1;
      update.reviewRound = nextRound;
      update.reviewRoundStartedAt = serverTimestamp();
      update.reviewManuscriptVersion = manuscriptVersion;
    }

    tx.update(ref as any, update);
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
