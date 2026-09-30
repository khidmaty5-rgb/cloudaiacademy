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

export default function ResearchPage() {
  const { lang } = useLang();
  const tr = (en: string, ar: string) => (lang === 'ar' ? ar : en);

  const initiatives: Initiative[] = [
    {
      slug: 'rag-evaluation-starter-kit',
      title: tr('RAG Evaluation Starter Kit', 'حزمة بداية لتقييم أنظمة RAG'),
      goal: tr(
        'Build a baseline harness for RAG evaluation with repeatable metrics and reporting templates.',
        'بناء إطار أساسي لتقييم أنظمة RAG بمقاييس قابلة للتكرار وقوالب موحّدة للتقارير.'
      ),
      who: tr('Students / Researchers / Engineers', 'الطلاب / الباحثون / المهندسون'),
      timeline: tr('4–8 weeks', '4–8 أسابيع'),
      deliverables: tr('Repository + evaluation + short report', 'مستودع شفرة + تقييم + تقرير مختصر'),
    },
    {
      slug: 'llmops-pipeline-reference',
      title: tr('LLMOps Pipeline Reference', 'مرجع لمسار عمليات النماذج اللغوية'),
      goal: tr(
        'Create a reference pipeline for training, evaluation, and versioning with CI checks and reproducibility notes.',
        'إنشاء مسار مرجعي للتدريب والتقييم وإدارة الإصدارات، مع فحوصات التكامل المستمر وملاحظات إعادة الإنتاج.'
      ),
      who: tr('Researchers / Engineers', 'الباحثون / المهندسون'),
      timeline: tr('6–10 weeks', '6–10 أسابيع'),
      deliverables: tr('Repository + CI checks + documentation + short report', 'مستودع شفرة + فحوصات CI + توثيق + تقرير مختصر'),
    },
    {
      slug: 'responsible-ai-checklist',
      title: tr('Responsible AI Project Checklist', 'قائمة فحص لمشروعات الذكاء الاصطناعي المسؤول'),
      goal: tr(
        'Publish a practical checklist and documentation template for privacy, safety, and governance in student projects.',
        'نشر قائمة فحص عملية وقالب توثيق للخصوصية والسلامة والحوكمة في مشروعات الطلاب.'
      ),
      who: tr('Students / Researchers', 'الطلاب / الباحثون'),
      timeline: tr('3–6 weeks', '3–6 أسابيع'),
      deliverables: tr('Checklist + templates + example implementation', 'قائمة فحص + قوالب + مثال تطبيقي'),
    },
    {
      slug: 'cloud-cost-observability-mini-toolkit',
      title: tr('Cloud Cost + Observability Mini-Toolkit', 'حزمة مصغّرة لتكلفة السحابة وقابلية المراقبة'),
      goal: tr(
        'Prototype a small toolkit for cost visibility and monitoring patterns for AI workloads.',
        'تطوير نموذج أولي لحزمة صغيرة توضّح التكلفة وأنماط مراقبة أحمال عمل الذكاء الاصطناعي.'
      ),
      who: tr('Engineers / Students', 'المهندسون / الطلاب'),
      timeline: tr('4–8 weeks', '4–8 أسابيع'),
      deliverables: tr('Mini-toolkit + patterns + short report', 'حزمة مصغّرة + أنماط تطبيق + تقرير مختصر'),
    },
  ];

  const studentTracks: StudentTrack[] = [
    {
      title: tr('Reading Group Track', 'مسار مجموعة القراءة'),
      timeline: tr('2–4 weeks', '2–4 أسابيع'),
      deliverable: tr('Paper summary + small reproduction attempt', 'ملخص ورقة بحثية + محاولة مصغّرة لإعادة الإنتاج'),
    },
    {
      title: tr('Build Track', 'مسار البناء'),
      timeline: tr('4–8 weeks', '4–8 أسابيع'),
      deliverable: tr('Repository + baseline + documentation', 'مستودع شفرة + خط أساس + توثيق'),
    },
    {
      title: tr('Publish Track', 'مسار النشر'),
      timeline: tr('8–12 weeks', '8–12 أسبوعاً'),
      deliverable: tr('Technical report + artifact checklist', 'تقرير تقني + قائمة فحص للمواد'),
    },
  ];

  const t = {
    hero: {
      title: tr('Building a Reproducible Research Environment for AI + Cloud', 'بناء بيئة أبحاث قابلة لإعادة الإنتاج في الذكاء الاصطناعي والسحابة'),
      sub: tr('Launch-phase programs in LLM systems, MLOps, data analytics, and Responsible AI—focused on reproducibility, evaluation, and real-world impact.', 'برامج في أنظمة النماذج اللغوية وعمليات تعلّم الآلة وتحليل البيانات والذكاء الاصطناعي المسؤول، مع التركيز على إعادة الإنتاج والتقييم والأثر الواقعي.'),
      ctaJoin: tr('Join a Project (Students & Researchers)', 'انضم إلى مشروع'),
      ctaPropose: tr('Propose a Project', 'اقترح مشروعاً'),
      ctaPartner: tr('Partner with Us', 'كن شريكاً معنا'),
      ctaContact: tr('Contact', 'تواصل معنا'),
      note: tr('No publications yet—this is a launch initiative. We are building our first technical reports and open-source artifacts.', 'لا توجد منشورات بعد؛ هذه مبادرة في مرحلة الإطلاق لبناء أول تقاريرنا التقنية وموادنا مفتوحة المصدر.'),
    },
    trust: {
      items: [
        { title: tr('Reproducibility-first standards', 'معايير تبدأ بقابلية إعادة الإنتاج'), href: '#standards', Icon: ClipboardCheck },
        { title: tr('Clear authorship & credit policy', 'سياسة واضحة للتأليف ونسب المساهمات'), href: '#standards', Icon: Scale },
        { title: tr('Artifact review checklist', 'قائمة فحص لمراجعة المواد'), href: '#reports', Icon: CheckCircle2 },
        { title: tr('Open collaboration model', 'نموذج تعاون مفتوح'), href: '#collaborate', Icon: Users },
      ],
    },
    initiatives: {
      title: tr('Active Initiatives (Open for Contributors)', 'مبادرات نشطة ومفتوحة للمساهمين'),
      sub: tr('Early-stage initiatives designed to produce reusable artifacts: code, evaluation, and short technical reports.', 'مبادرات مبكرة لإنتاج شفرة وتقييمات وتقارير تقنية مختصرة قابلة لإعادة الاستخدام.'),
      cta: tr('Join this initiative', 'انضم إلى هذه المبادرة'),
    },
    standards: {
      title: tr('How We Work (Launch Standards)', 'كيف نعمل: معايير الإطلاق'),
      bullets: [
        tr('Reproducibility-first: code + configs + evaluation notes', 'إعادة الإنتاج أولاً: الشفرة + الإعدادات + ملاحظات التقييم'),
        tr('Transparent contribution workflow (issues → PRs → review)', 'مسار مساهمة شفاف: مسائل ← طلبات دمج ← مراجعة'),
        tr('Authorship and credit guidelines', 'إرشادات واضحة للتأليف ونسب المساهمات'),
        tr('Ethical AI and privacy by design', 'ذكاء اصطناعي أخلاقي وخصوصية مدمجة في التصميم'),
        tr('Lightweight artifact review before publishing a report', 'مراجعة مبسطة للمواد قبل نشر التقرير'),
        tr('Documentation as a deliverable', 'التوثيق جزء أساسي من المخرجات'),
        tr('Regular research meetings and demos', 'اجتماعات بحثية وعروض دورية'),
      ],
      cta: tr('View Standards', 'عرض المعايير'),
      note: tr(
        'These standards keep launch-stage work reviewable, reusable, and ready for collaboration.',
        'تحافظ هذه المعايير على قابلية مراجعة أعمال مرحلة الإطلاق وإعادة استخدامها والتعاون عليها.'
      ),
    },
    students: {
      title: tr('For Students: How to Join', 'للطلاب: كيفية الانضمام'),
      sub: tr('Choose a track based on time, confidence, and what you want to ship.', 'اختر مساراً يناسب وقتك وخبرتك والمخرج الذي تريد إنجازه.'),
      cta: tr('Apply to Join a Track', 'قدّم للانضمام إلى مسار'),
    },
    reports: {
      title: tr('Technical Reports (Pilot)', 'التقارير التقنية التجريبية'),
      bullets: [
        tr('We will publish short technical reports with code and evaluation artifacts.', 'سننشر تقارير تقنية مختصرة تتضمن الشفرة ومواد التقييم.'),
        tr('This is a pilot stage with mentor review and artifact checks—not formal peer review yet.', 'هذه مرحلة تجريبية تشمل مراجعة المرشد وفحص المواد، وليست مراجعة أكاديمية رسمية بعد.'),
      ],
      ctaSubmit: tr('Register Interest to Submit', 'سجّل اهتمامك بالنشر'),
      ctaMentor: tr('Review / Mentor', 'المراجعة / الإرشاد'),
    },
    schedule: {
      title: tr('Community Schedule (Launch)', 'جدول المجتمع في مرحلة الإطلاق'),
      items: [
        { title: tr('Weekly reading group', 'مجموعة قراءة أسبوعية'), Icon: CalendarClock },
        { title: tr('Biweekly project demos', 'عروض للمشروعات كل أسبوعين'), Icon: CalendarClock },
        { title: tr('Monthly public workshop or talk', 'ورشة أو محاضرة عامة شهرية'), Icon: CalendarClock },
      ],
      cta: tr('Get notified', 'احصل على الإشعارات'),
      note: tr(
        'Times and access links are shared directly with active contributors.',
        'تُشارك المواعيد وروابط الحضور مباشرة مع المساهمين النشطين.'
      ),
    },
    collaborate: {
      title: tr('How We Collaborate', 'كيف نتعاون'),
      cards: [
        {
          title: tr('Join a Project', 'انضم إلى مشروع'),
          desc: tr('Pick an initiative or join an open issue, then ship a reproducible artifact with mentoring support.', 'اختر مبادرة أو مهمة مفتوحة، ثم أنجز مادة قابلة لإعادة الإنتاج بدعم من مرشد.'),
          href: '/research/join',
          Icon: Users,
          cta: tr('Join', 'انضم'),
        },
        {
          title: tr('Propose a Project', 'اقترح مشروعاً'),
          desc: tr('Bring an idea and we will help scope it into a measurable deliverable with clear evaluation.', 'قدّم فكرتك وسنساعدك على تحويلها إلى مخرج قابل للقياس والتقييم الواضح.'),
          href: '/research/propose',
          Icon: ArrowRight,
          cta: tr('Propose', 'اقترح'),
        },
        {
          title: tr('Mentor / Review', 'الإرشاد / المراجعة'),
          desc: tr('Help students and contributors by reviewing artifacts, documentation, and technical report drafts.', 'ساعد الطلاب والمساهمين من خلال مراجعة المواد والتوثيق ومسودات التقارير التقنية.'),
          href: '/research/mentor',
          Icon: CheckCircle2,
          cta: tr('Mentor', 'أرشد'),
        },
        {
          title: tr('Partner / Sponsor', 'الشراكة / الرعاية'),
          desc: tr('Support initiatives with data, infrastructure, compute credits, or real-world problem statements.', 'ادعم المبادرات بالبيانات أو البنية التحتية أو موارد الحوسبة أو تحديات واقعية.'),
          href: '/research/partner',
          Icon: Handshake,
          cta: tr('Partner', 'شارك'),
        },
      ],
      pipeline: tr('Propose → Build → Evaluate → Publish (Technical Report)', 'اقتراح ← بناء ← تقييم ← نشر تقرير تقني'),
    },
  };

  const contactHref = 'mailto:info@cloudaiacademy.ca';

  return (
    <>
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
                  <Card className="h-full border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md">
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
                <Card key={initiative.slug} className="border-border/70 bg-card shadow-sm">
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
                        <dt className="w-28 shrink-0 text-muted-foreground">{tr('Who it’s for', 'الفئة المناسبة')}</dt>
                        <dd dir="auto" className="font-medium text-foreground">
                          {initiative.who}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">{tr('Timeline', 'المدة')}</dt>
                        <dd dir="auto" className="font-medium text-foreground">
                          {initiative.timeline}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">{tr('Deliverables', 'المخرجات')}</dt>
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
                <Card className="border-border/70 bg-card shadow-sm lg:col-span-2">
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

                <Card className="border-border/70 bg-card shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <p dir="auto" className="text-sm text-muted-foreground">
                      {t.standards.note}
                    </p>
                    <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Link href="/research/standards">{t.standards.cta}</Link>
                    </Button>
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
                <Card key={track.title} className="border-border/70 bg-card shadow-sm">
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
                      <span className="font-medium text-foreground">{tr('Deliverable:', 'المخرج:')}</span> {track.deliverable}
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
              <Card className="border-border/70 bg-card shadow-sm">
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
                <Card key={title} className="border-border/70 bg-card shadow-sm">
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
                      {t.schedule.note}
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
                <Card key={title} className="border-border/70 bg-card shadow-sm">
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
                        <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Card className="border-border/70 bg-card shadow-sm">
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
    </>
  );
}
