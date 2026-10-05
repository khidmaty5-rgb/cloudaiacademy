'use client';
import { academy } from '@/lib/academy';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/logo';
import { LangToggle, useLang } from '@/components/i18n/lang';

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  const benefits = ar
    ? ['تعلّم عملي قائم على المشاريع', 'مسارات للسحابة والذكاء الاصطناعي', 'شهادات قابلة للمشاركة']
    : ['Project-based practical learning', 'Cloud and AI learning paths', 'Shareable completion certificates'];

  return (
    <main className="min-h-dvh bg-background" dir={ar ? 'rtl' : 'ltr'}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)]">
        <aside className="relative hidden overflow-hidden bg-primary px-10 py-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.2),transparent_42%)]" />
          <Link href="/" className="relative inline-flex w-fit" aria-label={ar ? 'العودة إلى الرئيسية' : 'Back to home'}>
            <Logo size={52} textClassName="text-primary-foreground" />
          </Link>
          <div className="relative max-w-xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {ar ? 'تعلّم. طبّق. تقدّم.' : 'Learn. Build. Advance.'}
            </p>
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              {ar ? 'طوّر مهارات المستقبل بثقة.' : 'Build future-ready skills with confidence.'}
            </h1>
            <ul className="space-y-3 text-primary-foreground/75">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 shrink-0 text-accent" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-sm text-primary-foreground/55">© {new Date().getFullYear()} {academy.name}</p>
        </aside>

        <section className="flex min-w-0 flex-col px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <BackIcon className="size-4" />
              {ar ? 'الرئيسية' : 'Home'}
            </Link>
            <LangToggle className="border-border bg-card text-foreground [&_button]:text-foreground" />
          </div>
          <div className="mx-auto flex w-full max-w-md flex-1 items-center py-10">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
