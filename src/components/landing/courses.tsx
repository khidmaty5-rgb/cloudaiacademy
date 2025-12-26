'use client';

import Image from 'next/image';
import Link from 'next/link';
import { collection, getFirestore, limit, orderBy, query } from 'firebase/firestore';
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
      <Card className="overflow-hidden group hover:shadow-xl transition-shadow duration-300 h-full border-accent border-2">
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
        <CardContent className="p-6">
          <Badge variant="secondary" className="bg-accent/10 text-accent mb-2">
            {course.category}
          </Badge>
          <CardTitle className="font-headline mb-2">{course.title}</CardTitle>
          <p className="text-muted-foreground mb-4 text-sm">{course.description}</p>
          <div className="text-2xl font-bold text-accent mb-4">{course.price}</div>
          <div className="flex justify-between text-muted-foreground text-sm border-t pt-4">
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
    () => query(collection(firestore, 'courses'), orderBy('createdAt', 'desc'), limit(6)),
    [firestore],
  );
  const { data: courses, isLoading, error } = useCollection(coursesQuery);

  return (
    <section id="courses" className="py-20 md:py-28 bg-muted/50">
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

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
