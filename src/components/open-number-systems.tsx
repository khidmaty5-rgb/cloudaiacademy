'use client';

import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { InteractiveLessonPlayer } from '@/components/learn/interactive-lesson-player';

export const NUMBER_SYSTEMS_PATH = '/open-courses/number-systems';

export function NumberSystemsCourseCard() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  return <section aria-label={ar ? 'دورة مفتوحة للجميع' : 'Open-access course'} className="my-6 space-y-3 rounded-2xl border bg-card p-6">
    <p className="text-sm font-medium text-accent">{ar ? 'مجاني · دون تسجيل · بالعربية · مبتدئ · 90 دقيقة' : 'Free · No registration · Arabic · Beginner · 90 minutes'}</p>
    <h2 className="text-2xl font-bold" dir="auto">{ar ? 'الأنظمة العددية' : 'Number Systems — الأنظمة العددية'}</h2>
    <p className="text-muted-foreground">{ar ? 'تعلّم الثنائي والثماني والعشري والسادس عشر مع مختبر تحويل واختبار تفاعلي.' : 'Learn binary, octal, decimal and hexadecimal with a conversion lab and an interactive quiz.'}</p>
    <Button asChild><Link href={NUMBER_SYSTEMS_PATH}>{ar ? 'ابدأ الدورة دون تسجيل' : 'Start course without registration'}</Link></Button>
  </section>;
}

export function OpenNumberSystems({ html }: { html: string }) {
  const { lang, dir } = useLang();
  const ar = lang === 'ar';
  return <main dir={dir} className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6">
    <Link href="/resources" className="text-sm underline underline-offset-4">{ar ? 'العودة إلى موارد المحاضرات' : 'Back to lecture resources'}</Link>
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">{ar ? 'الأنظمة العددية' : 'Number Systems — الأنظمة العددية'}</h1>
      <p className="text-muted-foreground">{ar ? 'دورة عربية مجانية للجميع · المستوى المبتدئ · 90 دقيقة · لا تحتاج إلى حساب أو تسجيل' : 'Free Arabic course for everyone · Beginner · 90 minutes · No account or enrollment required'}</p>
      <p className="text-sm text-muted-foreground">{ar ? 'تدرّب على التحويلات وأكمل الاختبار داخل الدرس. النتائج للتدريب فقط ولا تُحفظ؛ هذه الدورة لا تصدر شهادة.' : 'Practice conversions and take the quiz inside the lesson. Results are for practice only and are not saved; this course does not issue a certificate.'}</p>
    </header>
    <InteractiveLessonPlayer html={html} title="Number Systems — الأنظمة العددية" />
  </main>;
}
