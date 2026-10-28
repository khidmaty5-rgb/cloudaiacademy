'use client';

import Link from 'next/link';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { publishedOpenCourses } from '@/lib/open-courses';

export function OpenCoursesSection({ homepage = false }: { homepage?: boolean }) {
  const { lang, dir } = useLang();
  const courses = publishedOpenCourses();
  if (!courses.length) return null;
  const ar = lang === 'ar';
  return <section id="open-courses" dir={dir} aria-labelledby="open-courses-heading" className={homepage ? 'border-b bg-muted/30 py-12 sm:py-16' : 'my-8'}>
    <div className={homepage ? 'container space-y-7' : 'space-y-7'}>
      <header className="max-w-3xl space-y-3">
        <p className="text-sm font-semibold text-accent">{ar ? 'التعلّم متاح للجميع' : 'Learning for everyone'}</p>
        <h2 id="open-courses-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'دورات مجانية — دون تسجيل' : 'Free Courses — No Registration Required'}</h2>
        <p className="text-muted-foreground">{ar ? 'اختر دورة وابدأ التعلّم فورًا. لا تحتاج إلى حساب أو تسجيل في الدورة.' : 'Choose a course and start learning immediately. No account or enrollment needed.'}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {courses.map(course => <article key={course.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-accent/10 p-3 text-accent"><BookOpen aria-hidden="true" className="size-6" /></span>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">{ar ? 'مجاني · دون تسجيل' : 'Free · No registration'}</span>
          </div>
          <h3 className="break-words text-xl font-bold" dir="auto">{course.title[lang]}</h3>
          <p className="text-sm text-muted-foreground">{course.details[lang]}</p>
          <p className="text-muted-foreground">{course.description[lang]}</p>
          <Button asChild className="mt-auto h-auto min-h-10 whitespace-normal py-2"><Link href={course.href}>
            {ar ? 'ابدأ الدورة دون تسجيل' : 'Start course without registration'}<ArrowUpRight aria-hidden="true" className="ms-2 size-4 shrink-0" />
          </Link></Button>
        </article>)}
      </div>
    </div>
  </section>;
}
