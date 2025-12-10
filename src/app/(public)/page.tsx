
'use client';

import Cta from '@/components/landing/cta';
import Faq from '@/components/landing/faq';
import Features from '@/components/landing/features';
import Footer from '@/components/landing/footer';
import Header from '@/components/landing/header';
import Hero from '@/components/landing/hero';
import Pricing from '@/components/landing/pricing';
import Stats from '@/components/landing/stats';
import Testimonials from '@/components/landing/testimonials';
import Courses from '@/components/landing/courses';
 

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <Courses />
        <Pricing />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
