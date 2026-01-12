'use client';

import Link from 'next/link';
import { Handshake, Mail } from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export default function ResearchPartnerPage() {
  const { lang } = useLang();

  // TODO(i18n): Add Arabic strings for this page; for now we intentionally keep English copy so the language toggle works without broken content.
  const title = 'Partner with Us';
  const sub =
    'Support launch-phase initiatives with real-world problem statements, datasets, compute credits, or mentorship.';

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Research partnership (CloudAI Academy)')}`;

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
                    Start a conversation
                    <Handshake className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research">Back to Research</Link>
                </Button>
                <Button asChild variant="link" className="text-accent">
                  <Link href="/research/join">Join a Project</Link>
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
                  <CardTitle className="font-headline text-xl">Ways to partner</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Problem statements for students to build against</li>
                    <li>Datasets (with clear usage permissions)</li>
                    <li>Compute credits / cloud resources</li>
                    <li>Guest talks, mentorship, and review support</li>
                    <li>Sponsorship for workshops and community events</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">Contact</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    Email us with a short description of what you’d like to support and the type of collaboration you
                    prefer.
                  </p>
                  <Button asChild variant="outline">
                    <a href={mailto}>
                      Email {email}
                      <Mail className="ml-2 h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
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

