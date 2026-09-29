'use client';

import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

export default function ResearchSubmitPage() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const title = ar ? 'سجّل اهتمامك بالنشر' : 'Register Interest to Submit';
  const sub = ar
    ? 'التقارير التقنية التجريبية: ننشر تقارير مختصرة مع الشفرة ومواد التقييم، بعد مراجعة المرشد وفحص المواد، وليس تحكيماً علمياً رسمياً.'
    : 'Technical Reports (Pilot): we publish short reports with code + evaluation artifacts. This is mentor review + artifact checks (not formal peer review).';
  const requirements = ar
    ? ['رابط المستودع: الشفرة وملفات الإعداد', 'ملاحظات التقييم: المقاييس وخطوط الأساس والمحفزات والبيانات', 'تعليمات إعادة الإنتاج والنتائج المتوقعة', 'مسودة تقرير مختصر: الأهداف والمنهج والنتائج والقيود', 'معلومات التأليف ونسب المساهمات']
    : ['Repository link (code + configs)', 'Evaluation notes (metrics, baselines, prompts, datasets)', 'Reproduction instructions (how to run, expected outputs)', 'Short report draft (goals, methods, results, limitations)', 'Authorship & credit information'];

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Technical report submission interest')}`;

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
                  <a href={mailto}>
                    {ar ? 'راسلنا لتسجيل اهتمامك' : 'Email to register interest'}
                    <Mail className="ms-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/mentor">{ar ? 'المراجعة / الإرشاد' : 'Review / Mentor'}</Link>
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
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="font-headline text-xl">{ar ? 'ما الذي سنطلبه؟' : 'What we’ll ask for'}</CardTitle>
                    <Badge variant="secondary" className="bg-accent/10 text-accent">
                      {ar ? 'تجريبي' : 'Pilot'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc ps-5 space-y-2">
                    {requirements.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader className="space-y-2">
                  <CardTitle className="font-headline text-xl">{ar ? 'الشفافية في مرحلة الإطلاق' : 'Launch honesty'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    {ar ? 'لا ندّعي وجود منشورات أو فهرسة أو معامل تأثير أو معرّفات DOI أو صفة مجلة محكّمة.' : 'We do not claim publications, indexing, impact factor, DOI, or peer-reviewed journal status.'}
                  </p>
                  <p>
                    {ar ? 'مسار التقديم هذا تجريبي ويهدف إلى بناء مواد مفتوحة المصدر وتقارير تقنية عالية الجودة.' : 'This submission flow is a pilot designed to build high-quality open-source artifacts and technical reports.'}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span className="text-muted-foreground">{ar ? 'مراجعة المرشد وفحص المواد قبل النشر.' : 'Mentor review + artifact checks before posting.'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
