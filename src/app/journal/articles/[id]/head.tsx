import type { ReactNode } from 'react';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

function getAdminApp() {
  const name = 'adminAppJournalHead';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

async function fetchArticle(id: string) {
  const app = getAdminApp();
  const db = getFirestore(app);
  const snap = await db.doc(`journalArticles/${id}`).get();
  if (!snap.exists) return null as any;
  return { id, ...snap.data() } as any;
}

async function resolvePdfUrl(article: any) {
  return article?.pdfUrl || null;
}

export default async function Head(context: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await context.params;
  const article = await fetchArticle(id);
  if (!article || article.status !== 'PUBLISHED') return null;
  const pdfUrl = await resolvePdfUrl(article);
  const authors = String(article.authors || '');
  const authorList = authors.split(/\s*,\s*/).filter(Boolean);
  const keywords: string[] = Array.isArray(article.keywords) ? article.keywords : [];
  const acceptedAt = article.acceptedAt?.toDate?.() ?? article.acceptedAt;
  const publishedAt = article.publishedAt?.toDate?.() ?? article.publishedAt;
  const d: Date | null = publishedAt ? new Date(publishedAt) : (acceptedAt ? new Date(acceptedAt) : null);
  const y = d ? d.getFullYear() : NaN;
  const m = d ? (d.getMonth() + 1).toString().padStart(2, '0') : '';
  const day = d ? d.getDate().toString().padStart(2, '0') : '';
  const pubDate = Number.isNaN(y) ? '' : `${y}/${m}/${day}`;
  const language = (article.language === 'both' ? 'en' : article.language) || 'en';

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: article.title,
    name: article.title,
    description: article.abstract,
    author: authorList.map((a) => ({ '@type': 'Person', name: a })),
    datePublished: d ? d.toISOString() : undefined,
    inLanguage: language,
    isPartOf: { '@type': 'Periodical', name: 'CloudAI Journal' },
    url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/journal/articles/${id}`,
    encoding: pdfUrl ? [{ '@type': 'MediaObject', contentUrl: pdfUrl }] : undefined,
  };

  return (
    <>
      <meta name="citation_title" content={article.title} />
      {authorList.map((a, i) => (
        <meta key={`ca-${i}`} name="citation_author" content={a} />
      ))}
      <meta name="citation_publication_date" content={pubDate} />
      <meta name="citation_journal_title" content="CloudAI Journal" />
      <meta name="citation_language" content={language} />
      {pdfUrl ? <meta name="citation_pdf_url" content={pdfUrl} /> : null}
      {keywords.length ? (
        <meta name="citation_keywords" content={keywords.join(', ')} />
      ) : null}
      {article.abstract ? (
        <meta name="citation_abstract" content={article.abstract} />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}
