"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';

export default function Cta() {
  const { lang } = useLang();
  const heading = lang === 'ar' ? 'هل أنت جاهز لرفع مهاراتك؟' : 'Ready to Elevate Your Skills?';
  const sub =
    lang === 'ar'
      ? 'انضم إلى مجتمع متنامٍ من المتعلمين والمهنيين وطوّر مهاراتك عبر دورات عملية ومشاريع تطبيقية.'
      : 'Join a growing community building real skills through hands-on courses and projects.';
  const btn = lang === 'ar' ? 'ابدأ الآن' : 'Get Started Now';
  return (
    <section
      id="cta"
      className="relative overflow-hidden border-y border-primary-foreground/10 bg-primary py-20 text-primary-foreground md:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_transparent_55%)]" />
      <div className="container relative text-center">
        <h2 className="font-headline text-3xl md:text-4xl font-bold" dir="auto">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80" dir="auto">
          {sub}
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90"
        >
          <Link href="/signup">{btn}</Link>
        </Button>
      </div>
    </section>
  );
}
