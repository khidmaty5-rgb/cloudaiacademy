'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRight, CheckCircle2, Mail, Users } from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

const initiatives = [
  {
    slug: 'rag-evaluation-starter-kit',
    title: 'RAG Evaluation Starter Kit',
    summary: 'Baseline harness for RAG evaluation with repeatable metrics and reporting templates.',
    timeline: '4–8 weeks',
  },
  {
    slug: 'llmops-pipeline-reference',
    title: 'LLMOps Pipeline Reference',
    summary: 'Reference pipeline for training/evaluation/versioning with CI checks and reproducibility notes.',
    timeline: '6–10 weeks',
  },
  {
    slug: 'responsible-ai-checklist',
    title: 'Responsible AI Project Checklist',
    summary: 'Practical checklist + documentation templates for privacy, safety, and governance.',
    timeline: '3–6 weeks',
  },
  {
    slug: 'cloud-cost-observability-mini-toolkit',
    title: 'Cloud Cost + Observability Mini-Toolkit',
    summary: 'Small toolkit for cost visibility + monitoring patterns for AI workloads.',
    timeline: '4–8 weeks',
  },
] as const;

const tracks = [
  {
    title: 'Reading Group Track',
    timeline: '2–4 weeks',
    deliverable: 'Paper summary + small reproduction attempt',
  },
  {
    title: 'Build Track',
    timeline: '4–8 weeks',
    deliverable: 'Repo + baseline + documentation',
  },
  {
    title: 'Publish Track',
    timeline: '8–12 weeks',
    deliverable: 'Technical report + artifact checklist',
  },
] as const;

function ResearchJoinContent() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const initiativeParam = searchParams.get('initiative')?.trim() || '';
  const selectedInitiative = initiatives.find((i) => i.slug === initiativeParam) ?? null;

  // TODO(i18n): Add Arabic strings for this page; for now we intentionally keep English copy so the language toggle works without broken content.
  const t = {
    title: 'Join a Project (Students & Researchers)',
    sub: 'Launch-phase research is built through initiatives, weekly rhythm, and reproducible artifacts. Tell us what you want to work on and we will match you to a track or an initiative.',
    ctaEmail: 'Email to join',
    ctaPropose: 'Propose a Project',
    ctaBack: 'Back to Research',
    selectedTitle: 'Selected initiative',
    stepsTitle: 'What happens next',
    steps: ['Intro + fit check', 'Scope a deliverable', 'Build + evaluate', 'Publish a short technical report (pilot)'],
    tracksTitle: 'Student tracks',
    contactEmail: 'info@cloudaiacademy.ca',
  };

  const subject = selectedInitiative
    ? `Join initiative: ${selectedInitiative.title}`
    : 'Join a research project';

  const bodyText = selectedInitiative
    ? `Hi CloudAI Academy,\n\nI would like to join the initiative: ${selectedInitiative.title} (#${selectedInitiative.slug}).\n\nBackground:\nAvailability:\nLinks (GitHub/LinkedIn/portfolio):\n\nThanks!`
    : `Hi CloudAI Academy,\n\nI would like to join a research project.\n\nInterests (LLM systems / MLOps / Responsible AI / data analytics):\nBackground:\nAvailability:\nLinks (GitHub/LinkedIn/portfolio):\n\nThanks!`;

  const mailto = `mailto:${t.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="py-12 md:py-16 bg-muted/40">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-4">
              <h1 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
                {t.title}
              </h1>
              <p dir="auto" className="text-muted-foreground text-lg">
                {t.sub}
              </p>

              <div className="pt-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <a href={mailto}>
                    {t.ctaEmail}
                    <Mail className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/propose">
                    {t.ctaPropose}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="link" className="text-accent">
                  <Link href="/research">{t.ctaBack}</Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'TODO: Arabic translations for this page.' : 'TODO: Arabic translations for this page.'}
              </p>
            </div>
          </div>
        </section>

        {selectedInitiative && (
          <section className="py-10 bg-background">
            <div className="container">
              <Card className="max-w-4xl mx-auto bg-card/50 border-accent/30">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle dir="auto" className="font-headline text-xl">
                      {t.selectedTitle}: {selectedInitiative.title}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-accent/10 text-accent whitespace-nowrap">
                      {selectedInitiative.timeline}
                    </Badge>
                  </div>
                  <p dir="auto" className="text-sm text-muted-foreground">
                    {selectedInitiative.summary}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Next:</span> email us your background + availability and we will send onboarding details.
                  </div>
                  <Button asChild variant="outline">
                    <a href={mailto}>Email about this initiative</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center space-y-3">
                <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                  {t.stepsTitle}
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                {t.steps.map((step, idx) => (
                  <Card key={step} className="bg-card/50 border-accent/30">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          Step {idx + 1}
                        </Badge>
                        <Users className="h-4 w-4 text-accent" aria-hidden="true" />
                      </div>
                      <CardTitle dir="auto" className="font-headline text-base">
                        {step}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Pipeline:</span> Propose → Build → Evaluate → Publish (Technical Report)
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-muted/40">
          <div className="container">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="text-center space-y-3">
                <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                  {t.tracksTitle}
                </h2>
                <p dir="auto" className="text-muted-foreground">
                  Pick a track based on time and confidence. If you are unsure, start with the reading group track.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {tracks.map((track) => (
                  <Card key={track.title} className="bg-card/50 border-accent/30">
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle dir="auto" className="font-headline text-lg">
                          {track.title}
                        </CardTitle>
                        <Badge variant="secondary" className="bg-accent/10 text-accent whitespace-nowrap">
                          {track.timeline}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
                        <p dir="auto">
                          <span className="font-medium text-foreground">Deliverable:</span> {track.deliverable}
                        </p>
                      </div>
                      <Button asChild variant="outline" className="w-full">
                        <a href={mailto}>Join this track</a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>
                  Prefer to choose an initiative first? Go back to{' '}
                  <Link href="/research#initiatives" className="text-accent hover:underline">
                    Active Initiatives
                  </Link>
                  .
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function ResearchJoinPage() {
  return (
    <Suspense fallback={null}>
      <ResearchJoinContent />
    </Suspense>
  );
}
