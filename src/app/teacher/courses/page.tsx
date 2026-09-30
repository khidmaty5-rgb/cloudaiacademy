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
import { useLang } from '@/components/i18n/lang';

export default function TeacherCoursesPage() {
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
      <h1 className="font-headline text-3xl md:text-4xl font-bold">{ar ? 'دوراتي' : 'My Courses'}</h1>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : courses.length === 0 ? (
        <div className="text-muted-foreground">{ar ? 'لم يتم تعيين أي دورات لك بعد.' : 'You are not assigned to any courses yet.'}</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'العنوان' : 'Title'}</TableHead>
                <TableHead>{ar ? 'الفئة' : 'Category'}</TableHead>
                <TableHead>{ar ? 'المستوى' : 'Level'}</TableHead>
                <TableHead>{ar ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>{course.category}</TableCell>
                  <TableCell>{course.level}</TableCell>
                  <TableCell className="space-x-2">
                    <Link href={`/courses/${course.slug}`} className="text-accent hover:underline">{ar ? 'عرض' : 'View'}</Link>
                    <Link href={`/admin/courses/edit/${course.slug}`} className="text-accent hover:underline">{ar ? 'إدارة الدروس' : 'Manage Lessons'}</Link>
                    <LiveSessionButton course={course as any} label={ar ? 'بدء بث مباشر' : 'Start Live'} />
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
