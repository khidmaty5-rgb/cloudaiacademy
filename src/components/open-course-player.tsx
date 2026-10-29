'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { InteractiveLessonPlayer } from '@/components/learn/interactive-lesson-player';
import type { LessonPackage } from '@/lib/lesson-package';
import type { ManagedOpenCourse } from '@/lib/open-course-management';

export function OpenCourseLessons({ pkg }: { pkg: LessonPackage }) {
  const [selected, setSelected] = useState(0);
  const { lang } = useLang();
  const lesson = pkg.lessons[selected] || pkg.lessons[0];
  return <div className="space-y-4">
    {pkg.lessons.length > 1 && <nav aria-label={lang === 'ar' ? 'دروس الدورة' : 'Course lessons'} className="flex flex-wrap gap-2">
      {pkg.lessons.map((item, index) => <Button key={item.key} className="h-auto max-w-full whitespace-normal break-words text-start" variant={selected === index ? 'default' : 'outline'} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.title}</Button>)}
    </nav>}
    <InteractiveLessonPlayer key={lesson.key} html={lesson.interactiveHtml!} title={lesson.title} />
  </div>;
}
export default function PublicOpenCourse({ id }: { id: string }) {
  const { lang, dir } = useLang(); const ar = lang === 'ar';
  const [data, setData] = useState<{ course: ManagedOpenCourse; package: LessonPackage } | null>(null);
  const [error, setError] = useState(''); const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    void (async () => {
      try {
        const response = await fetch(`/api/open-courses/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? 'missing' : 'load');
        const result = await response.json(); if (!controller.signal.aborted) setData(result);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'load'); }
    })(); return () => controller.abort();
  }, [id, attempt]);
  return <main dir={dir} className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 sm:px-6">
    <Link href="/#open-courses" className="underline">{ar ? 'الدورات المفتوحة' : 'Open courses'}</Link>
    {error ? <div role="alert"><h1 className="text-2xl font-bold">{ar ? 'الدورة غير متاحة حاليًا' : 'Course currently unavailable'}</h1><p>{error === 'missing' ? (ar ? 'قد تكون مسودة أو تم سحب نشرها.' : 'It may be a draft or have been withdrawn.') : (ar ? 'تعذّر تحميل الدورة. حاول مجددًا.' : 'Could not load the course. Please retry.')}</p><Button onClick={() => retry(x => x + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div> : !data ? <p role="status">{ar ? 'جارٍ تحميل الدورة…' : 'Loading course…'}</p> : <>
      <header className="space-y-2 break-words"><h1 className="text-3xl font-bold" dir="auto">{data.course.title[lang]}</h1><p>{data.course.details[lang]}</p><p className="text-muted-foreground">{data.course.description[lang]}</p>
        <p className="text-sm text-muted-foreground">{ar ? 'مجاني دون تسجيل. نتائج التدريب لا تُحفظ ولا تصدر شهادة.' : 'Free, no registration. Practice results are not saved and no certificate is issued.'}</p></header>
      <OpenCourseLessons pkg={data.package} />
    </>}
  </main>;
}
