'use client';

import Image from 'next/image';
import Link from 'next/link';
import { collection, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import { Clock, Signal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLang } from '@/components/i18n/lang';
import { useCollection, useMemoFirebase } from '@/firebase';
import { getCourseImage } from '@/lib/course-images';

function CourseCard({ course }: { course: any }) {
  const image = getCourseImage(course);
  const isContain = image.fit === 'contain';
  return (
    <Link href={`/courses/${course.slug}`} className="block h-full">
      <Card className="group h-full overflow-hidden border border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl">
        <CardHeader className="p-0">
          <div className="relative w-full bg-white" style={{ aspectRatio: '3/2' }}>
            <div className={`absolute inset-0 ${isContain ? 'p-8' : ''}`}>
              <div className="relative h-full w-full">
                <Image
                  src={image.src}
                  alt={course.title}
                  fill
                  className={`${isContain ? 'object-contain' : 'object-cover'} bg-white ${isContain ? '' : 'group-hover:scale-105'} transition-transform duration-300`}
                  data-ai-hint={image.hint}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-64 flex-col p-6">
          <Badge dir="auto" variant="secondary" className="mb-2 w-fit bg-accent/10 text-accent">
            {course.category}
          </Badge>
          <CardTitle dir="auto" className="mb-2 line-clamp-2 font-headline">{course.title}</CardTitle>
          <p dir="auto" className="mb-4 line-clamp-3 text-sm text-muted-foreground">{course.description}</p>
          <div className="mt-auto mb-4 text-2xl font-bold text-accent">{course.price}</div>
          <div className="flex flex-wrap justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> {course.duration}
            </div>
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4" /> {course.level}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Courses() {
  const firestore = getFirestore();
  const { lang } = useLang();

  const coursesQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'courses'),
        where('status', '==', 'PUBLISHED'),
        orderBy('createdAt', 'desc'),
        limit(6),
      ),
    [firestore],
  );
  const { data: courses, isLoading, error } = useCollection(coursesQuery);

  return (
    <section id="courses" className="bg-muted/50 py-16 md:py-24">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {lang === 'ar' ? 'الدورات الأكثر شيوعًا' : 'Popular Courses'}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {lang === 'ar'
              ? 'استكشف دوراتنا الأكثر طلبًا في السحابة والذكاء الاصطناعي.'
              : 'Explore our most sought-after cloud and AI courses.'}
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}

          {!isLoading && error && (
            <div className="col-span-3 text-center rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              {lang === 'ar'
                ? 'تعذر تحميل الدورات. يرجى المحاولة مرة أخرى لاحقًا.'
                : 'Failed to load courses. Please try again later.'}
            </div>
          )}

          {!isLoading && !error && (courses || []).length === 0 && (
            <div className="col-span-3 text-center text-muted-foreground">
              {lang === 'ar' ? 'لا توجد دورات متاحة بعد.' : 'No courses available yet.'}
            </div>
          )}

          {!isLoading && !error && (courses || []).map((course) => <CourseCard key={course.id} course={course} />)}
        </div>

        <div className="text-center mt-12">
          <Link href="/courses" className="text-accent hover:underline font-semibold">
            {lang === 'ar' ? 'عرض جميع الدورات' : 'View All Courses'}
          </Link>
        </div>
      </div>
    </section>
  );
}
