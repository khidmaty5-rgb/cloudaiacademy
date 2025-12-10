'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getFirestore, query, where } from 'firebase/firestore';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import type { Course } from '@/types/models';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LiveSessionButton from '@/components/LiveSessionButton';

export default function TeacherCoursesPage() {
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
      <h1 className="font-headline text-3xl md:text-4xl font-bold">My Courses</h1>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <div className="text-muted-foreground">You are not assigned to any courses yet.</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>{course.category}</TableCell>
                  <TableCell>{course.level}</TableCell>
                  <TableCell className="space-x-2">
                    <Link href={`/courses/${course.slug}`} className="text-accent hover:underline">View</Link>
                    <Link href={`/admin/courses/edit/${course.slug}`} className="text-accent hover:underline">Manage</Link>
                    <LiveSessionButton courseId={course.id} label="Start Live" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
