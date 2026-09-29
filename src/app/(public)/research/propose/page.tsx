'use client';

import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export default function ResearchProposePage() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const title = ar ? 'اقترح مشروعاً' : 'Propose a Project';
  const sub = ar
    ? 'شاركنا فكرتك وسنساعدك على تحويلها إلى مخرج قابل للقياس وإعادة الإنتاج مع تقييم واضح.'
    : 'Bring an idea and we will help scope it into a measurable, reproducible deliverable with clear evaluation.';
  const includeItems = ar
    ? ['وصف المشكلة وأهميتها', 'المخرجات: المستودع والتقييم والتوثيق والتقرير المختصر', 'البيانات والأدوات المطلوبة وقيود الترخيص', 'خطة التقييم: المقاييس وخطوط الأساس وملاحظات إعادة الإنتاج', 'المدة المتوقعة، مثل 4–8 أسابيع', 'الفئة المستهدفة: طلاب أو باحثون أو مهندسون']
    : ['Problem statement and why it matters', 'Deliverables (repo, evaluation, documentation, short report)', 'Datasets/tools required (and licensing constraints)', 'Evaluation plan (metrics, baselines, reproducibility notes)', 'Timeline estimate (e.g., 4–8 weeks)', 'Who it’s for (students, researchers, engineers)'];

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Project proposal (Research)')}`;

  return (
    <>
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
                  <Link href="/research/join">
                    {ar ? 'انضم إلى مشروع' : 'Join a Project'}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={mailto}>
                    {ar ? 'راسلنا' : 'Email us'}
                    <Mail className="ms-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="link" className="text-accent">
                  <Link href="/research">{ar ? 'العودة إلى الأبحاث' : 'Back to Research'}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl grid gap-6 lg:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'ما الذي يجب تضمينه؟' : 'What to include'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc ps-5 space-y-2">
                    {includeItems.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'ملاحظة حول الإطلاق' : 'Launch note'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    {ar ? 'هذه مبادرة في مرحلة الإطلاق. لا ندّعي وجود منشورات أو فهرسة أو تحكيم علمي رسمي.' : 'This is a launch-phase initiative. We do not claim publications, indexing, or formal peer review.'}
                  </p>
                  <p>
                    {ar ? 'هدفنا إنتاج مواد قابلة لإعادة الإنتاج وتقارير تقنية تجريبية تخضع لمراجعة المرشد وفحص المواد.' : 'Our goal is to produce reproducible artifacts and pilot technical reports with mentor review and artifact checks.'}
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
