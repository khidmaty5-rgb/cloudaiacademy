'use client';

import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export default function ResearchMentorPage() {
  const { lang } = useLang();

  // TODO(i18n): Add Arabic strings for this page; for now we intentionally keep English copy so the language toggle works without broken content.
  const title = 'Mentor / Review';
  const sub =
    'Help contributors ship reproducible artifacts and improve drafts. This is mentoring—not formal peer review.';

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Mentor / reviewer interest (Research)')}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="bg-muted/40 py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-4">
              <h1 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
                {title}
              </h1>
              <p dir="auto" className="text-muted-foreground text-lg">
                {sub}
              </p>
              <div className="pt-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <a href={mailto}>
                    Email to volunteer
                    <Mail className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/submit">Register interest to submit</Link>
                </Button>
                <Button asChild variant="link" className="text-accent">
                  <Link href="/research">Back to Research</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'TODO: Arabic translations for this page.' : 'TODO: Arabic translations for this page.'}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">What mentors do</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Review issues and PRs for clarity, safety, and reproducibility</li>
                    <li>Help validate evaluation results and baselines</li>
                    <li>Guide documentation quality (setup, usage, limitations)</li>
                    <li>Provide feedback on technical report drafts</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">Launch standards</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    We use lightweight artifact checks to ensure work is reviewable and reproducible before publishing a
                    pilot technical report.
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
                    <Link href="/research/standards" className="text-accent hover:underline">
                      View standards
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

