'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';

const copy = {
  en: {
    dir: 'ltr' as const,
    title: 'Author Guidelines',
    subtitle: 'Submission requirements and review process for CloudAI Journal of Applied AI & Data.',
    back: 'Back to Journal',
    ctaSubmit: 'Submit an Article',
    ctaTemplate: 'Download Template (MD)',
    sections: [
      {
        title: 'What to include',
        bullets: [
          'Title, authors, affiliations, abstract, and 3–8 keywords.',
          'Clear statement of contributions, methods, datasets, and limitations.',
          'Link to code/data (GitHub, Zenodo, etc.) if available.',
          'Disclosure of AI tool usage in writing or experiments (if any).',
        ],
      },
      {
        title: 'File format',
        bullets: [
          'Submit as a single PDF (recommended) and keep it under the site upload limit.',
          'Use a clean structure: Introduction → Methods → Results → Limitations → References.',
          'Include figures/tables with captions and cite all sources clearly.',
        ],
      },
      {
        title: 'Peer review (reviewer login)',
        bullets: [
          'Editors assign reviewers to each submission.',
          'Reviewers sign in and submit feedback in the Reviewer Dashboard.',
          'Decisions are recorded as: Accept / Minor revision / Major revision / Reject.',
        ],
      },
      {
        title: 'Ethics & integrity',
        bullets: [
          'No plagiarism; cite prior work and include dataset licenses where relevant.',
          'Disclose any conflicts of interest and sensitive data handling.',
          'If human data is involved, include consent/ethics approval where applicable.',
        ],
      },
    ],
    contact: 'Questions:',
    email: 'journal@cloudaiacademy.ca',
  },
  ar: {
    dir: 'rtl' as const,
    title: 'إرشادات المؤلف',
    subtitle: 'متطلبات الإرسال وآلية التحكيم لمجلة CloudAI للأبحاث التطبيقية والبيانات.',
    back: 'العودة إلى المجلة',
    ctaSubmit: 'إرسال مقال',
    ctaTemplate: 'تحميل القالب (Markdown)',
    sections: [
      {
        title: 'ماذا يجب أن يتضمن البحث',
        bullets: [
          'العنوان، المؤلفون، الانتماءات، الملخص، والكلمات المفتاحية (3–8).',
          'توضيح المساهمات والمنهجية والبيانات والقيود بوضوح.',
          'روابط للكود/البيانات (إن وجدت).',
          'الإفصاح عن استخدام أدوات الذكاء الاصطناعي (إن وُجد).',
        ],
      },
      {
        title: 'صيغة الملف',
        bullets: [
          'الإرسال بصيغة PDF واحدة (مستحسن) مع الالتزام بحد حجم الرفع.',
          'هيكل واضح: مقدمة → منهجية → نتائج → قيود → مراجع.',
          'إدراج الجداول/الأشكال مع عناوين، وتوثيق المصادر.',
        ],
      },
      {
        title: 'التحكيم (تسجيل دخول للمحكمين)',
        bullets: [
          'يقوم فريق التحرير بتعيين المحكمين لكل إرسال.',
          'يسجل المحكم الدخول ويكتب المراجعة عبر لوحة المحكم.',
          'القرارات: قبول / تعديلات بسيطة / تعديلات كبيرة / رفض.',
        ],
      },
      {
        title: 'الأخلاقيات والنزاهة',
        bullets: [
          'منع الانتحال العلمي وتوثيق الأعمال السابقة والبيانات.',
          'الإفصاح عن تضارب المصالح والتعامل مع البيانات الحساسة.',
          'عند وجود بيانات بشرية: ذكر الموافقات/الخصوصية عند الحاجة.',
        ],
      },
    ],
    contact: 'للاستفسار:',
    email: 'journal@cloudaiacademy.ca',
  },
} as const;

export default function JournalGuidelinesPage() {
  const { lang, dir } = useLang();
  const t = copy[lang];
  const templateHref = '/templates/cloudai-technical-report-template.md';
  const router = useRouter();

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui, isLoading: isUiLoading } = useDoc<any>(settingsDocRef);
  const journalEnabled = ui?.showJournalNav !== false;

  useEffect(() => {
    if (isUiLoading) return;
    if (!journalEnabled) router.replace('/');
  }, [isUiLoading, journalEnabled, router]);

  if (!isUiLoading && !journalEnabled) return null;

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <Header />
      <main className="flex-1 bg-muted text-foreground">
        <section dir={dir} className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
          <div className="space-y-2">
            <Link href="/journal" className="text-sm text-muted-foreground hover:text-primary">
              {t.back}
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/journal/submit">{t.ctaSubmit}</Link>
            </Button>
            <Button asChild variant="outline" className="border-accent text-accent bg-background hover:bg-accent/10">
              <a href={templateHref} target="_blank" rel="noopener noreferrer">
                {t.ctaTemplate}
              </a>
            </Button>
          </div>

          <div className="space-y-6">
            {t.sections.map((s) => (
              <section key={s.title} className="rounded-2xl bg-card p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10">
                <h2 className="mb-3 text-lg font-semibold">{s.title}</h2>
                <ul className="list-disc space-y-1 ps-5 text-sm text-foreground">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {t.contact}{' '}
            <a className="underline underline-offset-2" href={`mailto:${t.email}`}>
              {t.email}
            </a>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
