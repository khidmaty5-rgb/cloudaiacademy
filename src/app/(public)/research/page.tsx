'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  Scale,
  Users,
} from 'lucide-react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

type Initiative = {
  slug: string;
  title: string;
  goal: string;
  who: string;
  timeline: string;
  deliverables: string;
};

type StudentTrack = {
  title: string;
  timeline: string;
  deliverable: string;
};

const initiatives: Initiative[] = [
  {
    slug: 'rag-evaluation-starter-kit',
    title: 'RAG Evaluation Starter Kit',
    goal: 'Build a baseline harness for RAG evaluation with repeatable metrics and reporting templates.',
    who: 'Students / Researchers / Engineers',
    timeline: '4–8 weeks',
    deliverables: 'Repo + evaluation + short report',
  },
  {
    slug: 'llmops-pipeline-reference',
    title: 'LLMOps Pipeline Reference',
    goal: 'Create a reference pipeline for training/evaluation/versioning with CI checks and reproducibility notes.',
    who: 'Researchers / Engineers',
    timeline: '6–10 weeks',
    deliverables: 'Repo + CI checks + documentation + short report',
  },
  {
    slug: 'responsible-ai-checklist',
    title: 'Responsible AI Project Checklist',
    goal: 'Publish a practical checklist and documentation template for privacy, safety, and governance in student projects.',
    who: 'Students / Researchers',
    timeline: '3–6 weeks',
    deliverables: 'Checklist + templates + example implementation',
  },
  {
    slug: 'cloud-cost-observability-mini-toolkit',
    title: 'Cloud Cost + Observability Mini-Toolkit',
    goal: 'Prototype a small toolkit for cost visibility + monitoring patterns for AI workloads.',
    who: 'Engineers / Students',
    timeline: '4–8 weeks',
    deliverables: 'Mini-toolkit + patterns + short report',
  },
];

const studentTracks: StudentTrack[] = [
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
];

export default function ResearchPage() {
  const { lang } = useLang();

  // TODO(i18n): Add Arabic strings for this page; for now we intentionally keep English copy so the language toggle works without broken content.
  const t = {
    hero: {
      title: 'Building a Reproducible Research Environment for AI + Cloud',
      sub: 'Launch-phase programs in LLM systems, MLOps, data analytics, and Responsible AI—focused on reproducibility, evaluation, and real-world impact.',
      ctaJoin: 'Join a Project (Students & Researchers)',
      ctaPropose: 'Propose a Project',
      ctaPartner: 'Partner with Us',
      ctaContact: 'Contact',
      note: 'No publications yet—this is a launch initiative. We are building our first technical reports and open-source artifacts.',
    },
    trust: {
      items: [
        { title: 'Reproducibility-first standards', href: '#standards', Icon: ClipboardCheck },
        { title: 'Clear authorship & credit policy', href: '#standards', Icon: Scale },
        { title: 'Artifact review checklist', href: '#reports', Icon: CheckCircle2 },
        { title: 'Open collaboration model', href: '#collaborate', Icon: Users },
      ],
    },
    initiatives: {
      title: 'Active Initiatives (Open for Contributors)',
      sub: 'Early-stage initiatives designed to produce reusable artifacts: code, evaluation, and short technical reports.',
      cta: 'Join this initiative',
    },
    standards: {
      title: 'How We Work (Launch Standards)',
      bullets: [
        'Reproducibility-first: code + configs + evaluation notes',
        'Transparent contribution workflow (issues → PRs → review)',
        'Authorship & credit guidelines',
        'Ethical AI and privacy-by-design',
        'Lightweight artifact review before publishing a report',
        'Documentation as a deliverable',
        'Regular research meetings + demos',
      ],
      cta: 'View Standards',
    },
    students: {
      title: 'For Students: How to Join',
      sub: 'Choose a track based on time, confidence, and what you want to ship.',
      cta: 'Apply to Join a Track',
    },
    reports: {
      title: 'Technical Reports (Pilot)',
      bullets: [
        'We will publish short technical reports with code and evaluation artifacts.',
        'This is a pilot stage—mentor review + artifact checks (not formal peer review yet).',
      ],
      ctaSubmit: 'Register Interest to Submit',
      ctaMentor: 'Review / Mentor',
    },
    schedule: {
      title: 'Community Schedule (Launch)',
      items: [
        { title: 'Weekly reading group', Icon: CalendarClock },
        { title: 'Biweekly project demos', Icon: CalendarClock },
        { title: 'Monthly public workshop/talk', Icon: CalendarClock },
      ],
      cta: 'Get notified',
    },
    collaborate: {
      title: 'How We Collaborate',
      cards: [
        {
          title: 'Join a Project',
          desc: 'Pick an initiative or join an open issue, then ship a reproducible artifact with mentoring support.',
          href: '/research/join',
          Icon: Users,
          cta: 'Join',
        },
        {
          title: 'Propose a Project',
          desc: 'Bring an idea and we will help scope it into a measurable deliverable with clear evaluation.',
          href: '/research/propose',
          Icon: ArrowRight,
          cta: 'Propose',
        },
        {
          title: 'Mentor / Review',
          desc: 'Help students and contributors by reviewing artifacts, documentation, and technical report drafts.',
          href: '/research/mentor',
          Icon: CheckCircle2,
          cta: 'Mentor',
        },
        {
          title: 'Partner / Sponsor',
          desc: 'Support initiatives with data, infrastructure, compute credits, or real-world problem statements.',
          href: '/research/partner',
          Icon: Handshake,
          cta: 'Partner',
        },
      ],
      pipeline: 'Propose → Build → Evaluate → Publish (Technical Report)',
    },
  };

  const contactHref = 'mailto:info@cloudaiacademy.ca';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="bg-muted/40 py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-4">
              <h1 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
                {t.hero.title}
              </h1>
              <p dir="auto" className="text-muted-foreground text-lg">
                {t.hero.sub}
              </p>

              <div className="pt-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href="/research/join" aria-label={t.hero.ctaJoin}>
                    {t.hero.ctaJoin}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/propose" aria-label={t.hero.ctaPropose}>
                    {t.hero.ctaPropose}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/research/partner" aria-label={t.hero.ctaPartner}>
                    {t.hero.ctaPartner}
                  </Link>
                </Button>
                <a href={contactHref} className="text-sm font-medium text-accent hover:underline">
                  {t.hero.ctaContact}
                </a>
              </div>

              <p dir="auto" className="text-sm text-muted-foreground">
                {t.hero.note}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-background py-10">
          <div className="container">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {t.trust.items.map(({ title, href, Icon }) => (
                <a key={title} href={href} className="group" aria-label={title}>
                  <Card className="h-full bg-card/50 border-accent/30 transition hover:border-accent/60 hover:shadow-md">
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                      <div className="rounded-full bg-accent/10 p-2 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <CardTitle dir="auto" className="font-headline text-sm font-semibold">
                        {title}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="initiatives" className="scroll-mt-24 bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-3">
              <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                {t.initiatives.title}
              </h2>
              <p dir="auto" className="text-muted-foreground">
                {t.initiatives.sub}
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              {initiatives.map((initiative) => (
                <Card key={initiative.slug} className="bg-card/50 border-accent/30">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle dir="auto" className="font-headline text-lg">
                        {initiative.title}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-accent/10 text-accent whitespace-nowrap">
                        {initiative.timeline}
                      </Badge>
                    </div>
                    <p dir="auto" className="text-sm text-muted-foreground">
                      {initiative.goal}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <dl className="space-y-3 text-sm">
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">Who it’s for</dt>
                        <dd dir="auto" className="font-medium text-foreground">
                          {initiative.who}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">Timeline</dt>
                        <dd dir="auto" className="font-medium text-foreground">
                          {initiative.timeline}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">Deliverables</dt>
                        <dd dir="auto" className="font-medium text-foreground">
                          {initiative.deliverables}
                        </dd>
                      </div>
                    </dl>

                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/research/join?initiative=${encodeURIComponent(initiative.slug)}`}>
                        {t.initiatives.cta}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="standards" className="scroll-mt-24 bg-muted/40 py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="text-center space-y-3">
                <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                  {t.standards.title}
                </h2>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 bg-card/50 border-accent/30">
                  <CardContent className="pt-6">
                    <ul className="space-y-3">
                      {t.standards.bullets.map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
                          <span dir="auto" className="text-sm text-muted-foreground">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-accent/30">
                  <CardContent className="pt-6 space-y-4">
                    <p dir="auto" className="text-sm text-muted-foreground">
                      Standards exist to keep work reviewable and reusable—especially at launch.
                    </p>
                    <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Link href="/research/standards">{t.standards.cta}</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ar'
                        ? 'TODO: Arabic content for standards page.'
                        : 'TODO: Arabic translations for standards content.'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="students" className="scroll-mt-24 bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-3">
              <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                {t.students.title}
              </h2>
              <p dir="auto" className="text-muted-foreground">
                {t.students.sub}
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {studentTracks.map((track) => (
                <Card key={track.title} className="bg-card/50 border-accent/30">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle dir="auto" className="font-headline text-lg">
                        {track.title}
                      </CardTitle>
                      <Badge variant="secondary" className="bg-muted text-muted-foreground whitespace-nowrap">
                        {track.timeline}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p dir="auto" className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Deliverable:</span> {track.deliverable}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/research/join">{t.students.cta}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="reports" className="scroll-mt-24 bg-muted/40 py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-3">
              <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                {t.reports.title}
              </h2>
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Card className="bg-card/50 border-accent/30">
                <CardContent className="pt-6 space-y-6">
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {t.reports.bullets.map((item) => (
                      <li key={item} className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
                        <span dir="auto">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Link href="/research/submit">{t.reports.ctaSubmit}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/research/mentor">{t.reports.ctaMentor}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="schedule" className="scroll-mt-24 bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-3">
              <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                {t.schedule.title}
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {t.schedule.items.map(({ title, Icon }) => (
                <Card key={title} className="bg-card/50 border-accent/30">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="rounded-full bg-accent/10 p-2 text-accent">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle dir="auto" className="font-headline text-base">
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p dir="auto" className="text-sm text-muted-foreground">
                      Cadence-based; times and links shared with contributors.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Button asChild variant="outline">
                <Link href="/research/join">{t.schedule.cta}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="collaborate" className="scroll-mt-24 bg-muted/40 py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-3">
              <h2 dir="auto" className="font-headline text-2xl md:text-3xl font-bold">
                {t.collaborate.title}
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {t.collaborate.cards.map(({ title, desc, href, Icon, cta }) => (
                <Card key={title} className="bg-card/50 border-accent/30">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-accent/10 p-2 text-accent">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <CardTitle dir="auto" className="font-headline text-lg">
                        {title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p dir="auto" className="text-sm text-muted-foreground">
                      {desc}
                    </p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href={href}>
                        {cta}
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Card className="bg-card/50 border-accent/30">
                <CardContent className="pt-6">
                  <p dir="auto" className="text-center text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{t.collaborate.pipeline}</span>
                  </p>
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

