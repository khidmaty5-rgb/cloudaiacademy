
'use client';
import { academy } from '@/lib/academy';

import Cta from '@/components/landing/cta';
import Faq from '@/components/landing/faq';
import Features from '@/components/landing/features';
import Hero from '@/components/landing/hero';
import Pricing from '@/components/landing/pricing';
import Stats from '@/components/landing/stats';
import Testimonials from '@/components/landing/testimonials';
import Courses from '@/components/landing/courses';
import Research from '@/components/landing/research';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { useLang } from '@/components/i18n/lang';
 

export default function Home() {
  const { lang } = useLang();
  const settingsRef = useMemoFirebase(() => doc(getFirestore(), 'settings', 'ui'), []);
  const { isLoading } = useDoc(settingsRef);
  // Do not paint default sections and then remove them when settings arrive.
  if (isLoading) return <main className="container flex min-h-[60dvh] items-center justify-center py-12" role="status"><p className="text-muted-foreground">{lang === 'ar' ? 'جارٍ تحميل الأكاديمية…' : 'Loading the academy…'}</p></main>;
  return (
    <>
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <Courses />
        {academy.features.research && <Research />}
        <Pricing />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
    </>
  );
}
