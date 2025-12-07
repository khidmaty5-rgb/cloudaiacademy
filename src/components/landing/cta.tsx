"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';

export default function Cta() {
  const { lang } = useLang();
  const heading = lang === 'ar' ? 'هل أنت جاهز لرفع مهاراتك؟' : 'Ready to Elevate Your Skills?';
  const sub =
    lang === 'ar'
      ? 'انضم إلى آلاف المهنيين الذين سرّعوا مسيرتهم المهنية مع CloudAI Academy.'
      : 'Join thousands of professionals who have accelerated their careers with CloudAI Academy.';
  const btn = lang === 'ar' ? 'ابدأ الآن' : 'Get Started Now';
  return (
    <section id="cta" className="py-20 md:py-28 bg-primary text-primary-foreground">
      <div className="container text-center">
        <h2 className="font-headline text-3xl md:text-4xl font-bold">
          {heading}
        </h2>
        <p className="mt-4 text-lg max-w-xl mx-auto text-primary-foreground/80">
          {sub}
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Link href="#">{btn}</Link>
        </Button>
      </div>
    </section>
  );
}
