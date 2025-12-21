export const runtime = 'nodejs';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import PdfSandbox from '@/components/journal/pdf-sandbox';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicFirestoreDoc } from '@/lib/firestore-public';

async function fetchArticle(id: string) {
  const doc = await fetchPublicFirestoreDoc(`journalArticles/${id}`);
  if (!doc) return null as any;
  return { id: doc.id, ...doc.data } as any;
}

function resolvePdfLinks(
  id: string,
  article: any,
): { viewHref: string; downloadHref: string } | null {
  const withDisposition = (href: string, disposition: 'inline' | 'attachment') => {
    if (!href) return href;
    if (href.includes('disposition=')) return href;
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}disposition=${disposition}`;
  };

  const hasPdfPath = typeof article?.pdfPath === 'string' && article.pdfPath.length > 0;
  const hasPdfUrl = typeof article?.pdfUrl === 'string' && article.pdfUrl.length > 0;

  if (hasPdfPath) {
    return {
      viewHref: `/api/journal/articles/${id}/download?disposition=inline`,
      downloadHref: `/api/journal/articles/${id}/download?disposition=attachment`,
    };
  }

  if (hasPdfUrl) {
    const href = String(article.pdfUrl);
    return {
      viewHref: withDisposition(href, 'inline'),
      downloadHref: withDisposition(href, 'attachment'),
    };
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

  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const url = `${site}/journal/articles/${id}`;
  const title = article.title || 'CloudAI Journal Article';
  const description = (article.abstract || '').slice(0, 300);

  const toDate = (v: any): Date | null => {
    if (!v) return null;
    if (typeof v?.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const authors = String(article.authors || '');
  const authorList = authors.split(/\s*,\s*/).filter(Boolean);
  const keywords: string[] = Array.isArray(article.keywords) ? article.keywords : [];
  const acceptedAt = toDate(article.acceptedAt);
  const publishedAt = toDate(article.publishedAt);
  const d: Date | null = publishedAt || acceptedAt;
  const pubDate =
    d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : '';
  const language = (article.language === 'both' ? 'en' : article.language) || 'en';
  const pdfUrl = site ? `${site}/api/journal/articles/${id}/download?disposition=inline` : undefined;

  const other: Record<string, string | string[]> = {
    citation_title: String(article.title || ''),
    citation_publication_date: pubDate,
    citation_journal_title: 'CloudAI Journal',
    citation_language: String(language),
  };
  if (authorList.length) other.citation_author = authorList;
  if (keywords.length) other.citation_keywords = keywords.join(', ');
  if (article.abstract) other.citation_abstract = String(article.abstract);
  if (pdfUrl) other.citation_pdf_url = pdfUrl;

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
    other,
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
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  const canonicalUrl = site ? `${site}/journal/articles/${id}` : `/journal/articles/${id}`;
  const pdfContentUrl = site
    ? `${site}/api/journal/articles/${id}/download?disposition=inline`
    : `/api/journal/articles/${id}/download?disposition=inline`;

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: article.title,
    name: article.title,
    description: article.abstract,
    author: authorList.map((a) => ({ '@type': 'Person', name: a })),
    datePublished:
      publishedAt && !Number.isNaN(new Date(publishedAt).getTime())
        ? new Date(publishedAt).toISOString()
        : undefined,
    inLanguage: (article.language === 'both' ? 'en' : article.language) || 'en',
    isPartOf: { '@type': 'Periodical', name: 'CloudAI Journal' },
    url: canonicalUrl,
    encoding: pdfLinks ? [{ '@type': 'MediaObject', contentUrl: pdfContentUrl }] : undefined,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16 bg-background">
        <div className="container max-w-3xl">
          <section className="space-y-6">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
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
                  <PdfSandbox
                    title={String(article.title || 'PDF')}
                    viewHref={pdfLinks.viewHref}
                    downloadHref={pdfLinks.downloadHref}
                  />
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
