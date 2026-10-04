'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, where } from 'firebase/firestore';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import type { Course } from '@/types/models';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCourseImage } from '@/lib/course-images';
import Image from 'next/image';
import LiveSessionButton from '@/components/LiveSessionButton';
import { useLang } from '@/components/i18n/lang';

export default function TeacherDashboardPage() {
  const { user } = useUser();
  const { isTeacher, loading } = useCurrentRole();
  const firestore = getFirestore();
  const uid = user?.uid;
  const { lang } = useLang();
  const ar = lang === 'ar';

  const ownerQuery = useMemoFirebase(() => {
    if (loading || !isTeacher || !uid) return null;
    return query(collection(firestore, 'courses'), where('ownerId', '==', uid));
  }, [firestore, uid, isTeacher, loading]);

  const instructorQuery = useMemoFirebase(() => {
    if (loading || !isTeacher || !uid) return null;
    return query(collection(firestore, 'courses'), where('instructorIds', 'array-contains', uid));
  }, [firestore, uid, isTeacher, loading]);

  const { data: ownedCourses, isLoading: loadingOwned } = useCollection<Course>(ownerQuery);
  const { data: assignedCourses, isLoading: loadingAssigned } = useCollection<Course>(instructorQuery);

  const courses = useMemo(() => {
    const map: Record<string, Course> = {} as any;
    for (const c of ownedCourses || []) map[c.id] = c as any;
    for (const c of assignedCourses || []) map[c.id] = c as any;
    return Object.values(map);
  }, [ownedCourses, assignedCourses]);

  if (loading || !user) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (!isTeacher) {
    return <div className="text-center py-16 text-muted-foreground">{ar ? 'لا تملك صلاحية الوصول.' : 'No permission.'}</div>;
  }

  const isLoading = loadingOwned || loadingAssigned;

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl md:text-4xl font-bold">{ar ? 'لوحة التدريس' : 'Teaching Dashboard'}</h1>
      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-muted-foreground">{ar ? 'لم يتم تعيين أي دورات لك بعد.' : 'You are not assigned to any courses yet.'}</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-6">
          {courses.map((course) => {
            const image = getCourseImage(course as any);
            const isContain = image.fit === 'contain';
            return (
              <Card key={course.id} className="overflow-hidden h-full">
                <CardHeader className="p-0">
                  <div className="relative w-full bg-white" style={{ aspectRatio: '3/2' }}>
                    {isContain ? (
                      <div className="absolute inset-0 p-8">
                        <div className="relative h-full w-full">
                          <Image
                            src={image.src}
                            alt={course.title}
                            fill
                            className="object-contain bg-white"
                            data-ai-hint={image.hint}
                          />
                        </div>
                      </div>
                    ) : (
                      <Image
                        src={image.src}
                        alt={course.title}
                        fill
                        className="object-cover bg-white"
                        data-ai-hint={image.hint}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-3">
                  <CardTitle className="font-headline text-lg">{course.title}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Button asChild variant="secondary">
                      <Link href={`/courses/${course.slug}`}>View Course</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/admin/courses/edit/${course.slug}`}>Manage Lessons</Link>
                    </Button>
                    <LiveSessionButton course={course as any} label="Start Live Class" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
