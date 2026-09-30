
'use client';

import Cta from '@/components/landing/cta';
import Faq from '@/components/landing/faq';
import Features from '@/components/landing/features';
import Hero from '@/components/landing/hero';
import Pricing from '@/components/landing/pricing';
import Stats from '@/components/landing/stats';
import Testimonials from '@/components/landing/testimonials';
import Courses from '@/components/landing/courses';
import Research from '@/components/landing/research';
 

export default function Home() {
  return (
    <>
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <Courses />
        <Research />
        <Pricing />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
    </>
  );
}
