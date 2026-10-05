'use client';
import { academy } from '@/lib/academy';

import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export default function ResearchMentorPage() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const title = ar ? 'الإرشاد والمراجعة' : 'Mentor / Review';
  const sub = ar
    ? 'ساعد المساهمين على إنتاج مواد قابلة لإعادة الاستخدام وتحسين المسودات. هذا إرشاد تقني وليس تحكيماً علمياً رسمياً.'
    : 'Help contributors ship reproducible artifacts and improve drafts. This is mentoring—not formal peer review.';
  const mentorTasks = ar
    ? ['مراجعة القضايا وطلبات الدمج من حيث الوضوح والسلامة وقابلية إعادة الإنتاج', 'المساعدة في التحقق من نتائج التقييم وخطوط الأساس', 'توجيه جودة التوثيق: الإعداد والاستخدام والقيود', 'تقديم ملاحظات على مسودات التقارير التقنية']
    : ['Review issues and PRs for clarity, safety, and reproducibility', 'Help validate evaluation results and baselines', 'Guide documentation quality (setup, usage, limitations)', 'Provide feedback on technical report drafts'];

  const email = academy.contactEmail;
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Mentor / reviewer interest (Research)')}`;

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
                    {ar ? 'راسلنا للتطوع' : 'Email to volunteer'}
                    <Mail className="ms-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research/submit">{ar ? 'سجّل اهتمامك بالنشر' : 'Register interest to submit'}</Link>
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
            <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'ما الذي يقدمه المرشدون؟' : 'What mentors do'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc ps-5 space-y-2">
                    {mentorTasks.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'معايير الإطلاق' : 'Launch standards'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    {ar ? 'نستخدم فحوصات عملية للمواد لضمان قابلية العمل للمراجعة وإعادة الإنتاج قبل نشر التقرير التقني التجريبي.' : 'We use lightweight artifact checks to ensure work is reviewable and reproducible before publishing a pilot technical report.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
                    <Link href="/research/standards" className="text-accent hover:underline">
                      {ar ? 'عرض المعايير' : 'View standards'}
                    </Link>
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
