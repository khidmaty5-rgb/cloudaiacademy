"use client";

import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function JournalArticlePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const firestore = getFirestore();
  const { lang, dir } = useLang();
  const router = useRouter();

  const t = {
    en: {
      back: 'Back to journal',
      notFound: 'Article not found.',
      language: 'Language',
      status: 'Status',
      issue: 'Issue',
      noIssue: 'Not assigned to an issue',
      pdf: 'View PDF',
      code: 'Code / Data',
    },
    ar: {
      back: 'الرجوع إلى المجلة',
      notFound: 'لم يتم العثور على المقالة.',
      language: 'اللغة',
      status: 'الحالة',
      issue: 'العدد',
      noIssue: 'غير مرفق بعدد',
      pdf: 'عرض ملف PDF',
      code: 'الكود / البيانات',
    },
  }[lang];

  const articleDocRef = useMemoFirebase(() => {
    if (!id) return null;
    return doc(firestore, 'journalArticles', id);
  }, [firestore, id]);

  const { data: article, isLoading } = useDoc<any>(articleDocRef as any);

  const issueDocRef = useMemoFirebase(() => {
    if (!article?.issueId) return null;
    return doc(firestore, 'journalIssues', article.issueId);
  }, [firestore, article?.issueId]);

  const { data: issue } = useDoc<any>(issueDocRef as any);

  const issueLabel =
    (article as any)?.issueLabel ||
    (issue as any)?.label ||
    t.noIssue;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16 bg-background">
        <div className="container max-w-3xl">
          <section dir={dir} className="space-y-6">
            <button
              type="button"
              onClick={() => router.push('/journal')}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              ← {t.back}
            </button>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !article ? (
              <p className="mt-6 text-sm text-muted-foreground">{t.notFound}</p>
            ) : (
              <article className="space-y-6">
                <header className="space-y-2">
                  <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    {article.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {article.authors}
                  </p>
                </header>

                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                    <span className="font-semibold me-1">{t.language}:</span>
                    <span className="uppercase">{article.language}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                    <span className="font-semibold me-1">{t.status}:</span>
                    <span>{article.status}</span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-3 py-1">
                    <span className="font-semibold me-1">{t.issue}:</span>
                    <span>{issueLabel}</span>
                  </span>
                </div>

                <section className="space-y-2">
                  <h2 className="text-lg font-semibold">
                    {lang === 'ar' ? 'الملخص' : 'Abstract'}
                  </h2>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                    {article.abstract}
                  </p>
                </section>

                <div className="flex flex-wrap gap-3">
                  {article.pdfUrl && (
                    <Button
                      asChild
                      className="bg-accent text-accent-foreground"
                    >
                      <a
                        href={article.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.pdf}
                      </a>
                    </Button>
                  )}
                  {article.codeUrl && (
                    <Button variant="outline" asChild>
                      <a
                        href={article.codeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.code}
                      </a>
                    </Button>
                  )}
                </div>
              </article>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
