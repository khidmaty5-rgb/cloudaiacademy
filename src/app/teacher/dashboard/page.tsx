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
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Image from 'next/image';
import LiveSessionButton from '@/components/LiveSessionButton';

export default function TeacherDashboardPage() {
  const { user } = useUser();
  const { isTeacher, loading } = useCurrentRole();
  const firestore = getFirestore();
  const uid = user?.uid;

  const ownerQuery = useMemoFirebase(() => {
    if (!uid) return null;
    return query(collection(firestore, 'courses'), where('ownerId', '==', uid));
  }, [firestore, uid]);

  const instructorQuery = useMemoFirebase(() => {
    if (!uid) return null;
    return query(collection(firestore, 'courses'), where('instructorIds', 'array-contains', uid));
  }, [firestore, uid]);

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
    return <div className="text-center py-16 text-muted-foreground">No permission.</div>;
  }

  const isLoading = loadingOwned || loadingAssigned;

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl md:text-4xl font-bold">Teaching Dashboard</h1>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-muted-foreground">You are not assigned to any courses yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const image = getPlaceholderImage(course.imageId);
            return (
              <Card key={course.id} className="overflow-hidden h-full">
                <CardHeader className="p-0">
                  <div className="relative h-40 w-full bg-white">
                    {image && (
                      <Image
                        src={image.imageUrl}
                        alt={course.title}
                        fill
                        className="object-contain bg-white"
                        data-ai-hint={image.imageHint}
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
                    <LiveSessionButton courseId={course.id} label="Start Live Class" />
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
