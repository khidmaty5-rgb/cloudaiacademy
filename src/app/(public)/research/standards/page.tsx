'use client';
import { academy } from '@/lib/academy';

import Link from 'next/link';
import { CheckCircle2, ClipboardList, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

export default function ResearchStandardsPage() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const title = ar ? 'معايير الأبحاث في مرحلة الإطلاق' : 'Research Standards (Launch)';
  const sub = ar
    ? 'معايير عملية للحفاظ على قابلية العمل لإعادة الإنتاج والمراجعة ونسب المساهمات، خصوصاً قبل وجود منشورات.'
    : 'Practical standards to keep work reproducible, reviewable, and creditable—especially before we have publications.';

  const email = academy.contactEmail;
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Research standards question')}`;

  const artifactChecklist = ar
    ? ['مستودع يحتوي على شفرة قابلة للتشغيل وملفات الإعداد', 'تعليمات واضحة للوصول إلى البيانات أو عينة اصطناعية', 'برنامج تقييم ومقاييس وخطوط أساس', 'ملاحظات إعادة الإنتاج: النتائج المتوقعة والقيود', 'توثيق يشمل README والإعداد والاستخدام', 'مسودة تقرير مختصر: الأهداف والمنهج والنتائج']
    : ['Repository with runnable code + configs', 'Clear dataset access instructions (or synthetic sample)', 'Evaluation script + metrics + baselines', 'Reproduction notes (expected outputs, limitations)', 'Documentation (README + setup + usage)', 'Short report draft (goals, method, results)'];

  const creditGuidelines = ar
    ? ['حدّد الأدوار مبكراً: القائد والمساهمون والمراجعون والمرشدون', 'يستند التقدير إلى مساهمات قابلة للقياس: الشفرة والتقييم والتوثيق', 'اذكر مصادر البيانات والأدوات والمساهمات الخارجية', 'كن واضحاً بشأن ما تمت إعادة إنتاجه وما تم بناؤه حديثاً']
    : ['Define roles early (lead, contributors, reviewers, mentors)', 'Credit is based on measurable contributions (code, eval, docs)', 'Acknowledge datasets/tools and external contributions', 'Be transparent about what was reproduced vs. newly built'];

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
                  <Link href="/research/join">{ar ? 'انضم إلى مشروع' : 'Join a Project'}</Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={mailto}>
                    {ar ? 'اطرح سؤالاً' : 'Ask a question'}
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
            <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-headline text-xl">{ar ? 'قائمة فحص المواد' : 'Artifact checklist'}</CardTitle>
                    <Badge variant="secondary" className="bg-accent/10 text-accent">
                      {ar ? 'إطلاق' : 'Launch'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {artifactChecklist.map((item) => (
                    <div key={item} className="flex gap-3">
                      <ClipboardList className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
                      <span dir="auto">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'التأليف ونسب المساهمات' : 'Authorship & credit (simple)'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  {creditGuidelines.map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
                      <span dir="auto">{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
