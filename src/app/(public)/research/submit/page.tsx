'use client';

import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

export default function ResearchSubmitPage() {
  const { lang } = useLang();

  // TODO(i18n): Add Arabic strings for this page; for now we intentionally keep English copy so the language toggle works without broken content.
  const title = 'Register Interest to Submit';
  const sub =
    'Technical Reports (Pilot): we publish short reports with code + evaluation artifacts. This is mentor review + artifact checks (not formal peer review).';

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Technical report submission interest')}`;

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
                    Email to register interest
                    <Mail className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/mentor">Review / Mentor</Link>
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
            <div className="mx-auto max-w-4xl grid gap-6 lg:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-headline text-xl">What we’ll ask for</CardTitle>
                    <Badge variant="secondary" className="bg-accent/10 text-accent">
                      Pilot
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Repository link (code + configs)</li>
                    <li>Evaluation notes (metrics, baselines, prompts, datasets)</li>
                    <li>Reproduction instructions (how to run, expected outputs)</li>
                    <li>Short report draft (goals, methods, results, limitations)</li>
                    <li>Authorship & credit information</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader className="space-y-2">
                  <CardTitle className="font-headline text-xl">Launch honesty</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    We do not claim publications, indexing, impact factor, DOI, or peer-reviewed journal status.
                  </p>
                  <p>
                    This submission flow is a pilot designed to build high-quality open-source artifacts and technical
                    reports.
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span className="text-muted-foreground">Mentor review + artifact checks before posting.</span>
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

