export const runtime = 'nodejs';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

function getAdminApp() {
  const name = 'adminAppJournalPage';
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
  const data = snap.data() as any;
  return { id, ...data } as any;
}

function resolvePdfLinks(
  id: string,
  article: any,
): { viewHref: string; downloadHref: string } | null {
  const hasPdfPath = typeof article?.pdfPath === 'string' && article.pdfPath.length > 0;
  const hasPdfUrl = typeof article?.pdfUrl === 'string' && article.pdfUrl.length > 0;

  if (hasPdfPath) {
    return {
      viewHref: `/api/journal/articles/${id}/download?disposition=inline`,
      downloadHref: `/api/journal/articles/${id}/download?disposition=attachment`,
    };
  }

  if (hasPdfUrl) {
    return { viewHref: article.pdfUrl, downloadHref: article.pdfUrl };
  }

  return null;
}

export async function generateMetadata(context: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await context.params;
  const article = await fetchArticle(id);
  if (!article || article.status !== 'PUBLISHED') {
    return { title: 'Article not found - CloudAI Journal' };
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || '';
  const url = `${site}/journal/articles/${id}`;
  const title = article.title || 'CloudAI Journal Article';
  const description = (article.abstract || '').slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function JournalArticlePage(context: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await context.params;
  const article = await fetchArticle(id);
  if (!article || article.status !== 'PUBLISHED') return notFound();
  const pdfLinks = resolvePdfLinks(id, article);
  const authors = String(article.authors || '');
  const affs: string[] = Array.isArray(article.affiliations) ? article.affiliations : [];
  const authorList = authors.split(/\s*,\s*/).filter(Boolean);
  const keywords: string[] = Array.isArray(article.keywords) ? article.keywords : [];
  const license = article.license || '—';
  const acceptedAt = article.acceptedAt?.toDate?.() ?? article.acceptedAt;
  const publishedAt = article.publishedAt?.toDate?.() ?? article.publishedAt;
  const year = (publishedAt ? new Date(publishedAt) : (acceptedAt ? new Date(acceptedAt) : null))?.getFullYear() || '';

  const cite = `${authors} (${year}). ${article.title}. CloudAI Journal.`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16 bg-background">
        <div className="container max-w-3xl">
          <section className="space-y-6">
            <a href="/journal" className="text-sm text-muted-foreground hover:text-primary">← Back to journal</a>

            <article className="space-y-6">
              <header className="space-y-2">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">{article.title}</h1>
                <p className="text-sm text-muted-foreground">{authors}</p>
                {affs.length ? (
                  <ul className="text-xs text-muted-foreground list-disc ms-5">
                    {affs.map((af, i) => (
                      <li key={i}>{af}</li>
                    ))}
                  </ul>
                ) : null}
              </header>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                  <span className="font-semibold me-1">Language:</span>
                  <span className="uppercase">{article.language}</span>
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                  <span className="font-semibold me-1">License:</span>
                  <span>{license}</span>
                </span>
                {acceptedAt ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                    <span className="font-semibold me-1">Accepted:</span>
                    <span>{new Date(acceptedAt).toLocaleDateString()}</span>
                  </span>
                ) : null}
                {publishedAt ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                    <span className="font-semibold me-1">Published:</span>
                    <span>{new Date(publishedAt).toLocaleDateString()}</span>
                  </span>
                ) : null}
              </div>

              {keywords.length ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k, i) => (
                    <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">{k}</span>
                  ))}
                </div>
              ) : null}

              <section className="space-y-2">
                <h2 className="text-lg font-semibold">Abstract</h2>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">{article.abstract}</p>
              </section>

              <div className="flex flex-wrap gap-3">
                {pdfLinks ? (
                  <>
                    <Button asChild className="bg-accent text-accent-foreground">
                      <a href={pdfLinks.viewHref} target="_blank" rel="noopener noreferrer">
                        View PDF
                      </a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href={pdfLinks.downloadHref} target="_blank" rel="noopener noreferrer">
                        Download PDF
                      </a>
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">PDF not available</span>
                )}
                {article.codeUrl ? (
                  <Button variant="outline" asChild>
                    <a href={article.codeUrl} target="_blank" rel="noopener noreferrer">Code / Data</a>
                  </Button>
                ) : null}
              </div>

              <section className="space-y-2 border-t pt-4">
                <h3 className="text-base font-semibold">How to cite this article</h3>
                <p className="text-sm text-muted-foreground">{cite}</p>
              </section>
            </article>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
