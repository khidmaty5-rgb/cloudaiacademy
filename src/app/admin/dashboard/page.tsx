'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, getFirestore, collection, query, doc } from 'firebase/firestore';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, DollarSign, LineChart, BarChart } from 'lucide-react';
import { format } from 'date-fns';
import { RevenueChart } from '@/components/admin/RevenueChart';
 
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';

function toDateValue(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  isLoading: boolean;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const dashboardText = {
  en: {
    adminDashboard: 'Admin Dashboard',
    teacherDashboard: 'Teacher Dashboard',
    totalRevenue: 'Total Revenue',
    totalUsers: 'Total Users',
    totalEnrollments: 'Total Enrollments',
    monthlyGrowth: 'Monthly Growth',
    revenueByCourse: 'Revenue by Course',
    revenueByCourseDesc: 'A breakdown of revenue from each course.',
    recentEnrollments: 'Recent Enrollments',
    recentEnrollmentsDesc: 'The 5 most recent course enrollments.',
    student: 'Student',
    course: 'Course',
    date: 'Date',
    noRecentEnrollments: 'No recent enrollments.',
    noPermission: 'You do not have permission to view this page.',
    manageUsers: 'Manage Users',
    manageCourses: 'Manage Courses',
    growthThisMonth: (count: number) => `+${count} this month`,
  },
  ar: {
    adminDashboard: 'لوحة تحكم المشرف',
    teacherDashboard: 'لوحة تحكم المعلم',
    totalRevenue: 'إجمالي الإيرادات',
    totalUsers: 'إجمالي المستخدمين',
    totalEnrollments: 'إجمالي التسجيلات',
    monthlyGrowth: 'النمو الشهري',
    revenueByCourse: 'الإيرادات حسب الدورة',
    revenueByCourseDesc: 'توزيع الإيرادات لكل دورة.',
    recentEnrollments: 'أحدث التسجيلات',
    recentEnrollmentsDesc: 'آخر 5 تسجيلات في الدورات.',
    student: 'الطالب',
    course: 'الدورة',
    date: 'التاريخ',
    noRecentEnrollments: 'لا توجد تسجيلات حديثة.',
    noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    manageUsers: 'إدارة المستخدمين',
    manageCourses: 'إدارة الدورات',
    growthThisMonth: (count: number) => `+${count} هذا الشهر`,
  },
} as const;

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const { isAdmin, isTeacher, loading: roleLoading } = useCurrentRole();
  const roleLabel = isAdmin ? 'Admin' : isTeacher ? 'Teacher' : null;
  const { lang } = useLang();
  const t = dashboardText[lang];

  // Fetch user profile to check role
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  // Fetch all users for total user count and growth calculation (admin-only)
  const canListUsers = isAdmin;

  const usersQuery = useMemoFirebase(
    () => (canListUsers ? collection(firestore, 'users') : null),
    [firestore, canListUsers]
  );
  const { data: users, isLoading: isUsersLoading, error: usersError } = useCollection(usersQuery);

  // Fetch all enrollments for total enrollment count and revenue
  const canListEnrollments = isAdmin || isTeacher;
  const enrollmentsQuery = useMemoFirebase(
    () => (canListEnrollments ? query(collectionGroup(firestore, 'enrollments')) : null),
    [firestore, canListEnrollments]
  );
  const { data: enrollments, isLoading: isEnrollmentsLoading, error: enrollmentsError } = useCollection(enrollmentsQuery);

  const coursesQuery = useMemoFirebase(
    () => collection(firestore, 'courses'),
    [firestore]
  );
  const { data: allCourses, isLoading: isCoursesLoading, error: coursesError } =
    useCollection(coursesQuery);

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    if (!enrollments || !allCourses) return 0;
    return enrollments.reduce((acc, enrollment) => {
      const course = allCourses.find((c) => c.id === enrollment.courseId);
      if (course && course.price && typeof course.price === 'string' && course.price.startsWith('$')) {
        const priceNumber = parseFloat(course.price.replace('$', ''));
        return acc + priceNumber;
      }
      return acc;
    }, 0);
  }, [enrollments, allCourses]);
  
  // Calculate revenue by course for the chart
  const revenueByCourse = useMemo(() => {
    if (!enrollments || !allCourses) return [];
    
    const revenueMap = new Map<string, { name: string; revenue: number }>();

    enrollments.forEach(enrollment => {
        const course = allCourses.find(c => c.id === enrollment.courseId);
        if (course && course.price && typeof course.price === 'string' && course.price.startsWith('$')) {
            const priceNumber = parseFloat(course.price.replace('$', ''));
            const existing = revenueMap.get(course.title) || { name: course.title, revenue: 0 };
            existing.revenue += priceNumber;
            revenueMap.set(course.title, existing);
        }
    });

    return Array.from(revenueMap.values());
}, [enrollments, allCourses]);

  // Calculate user growth percentage
  const userGrowth = useMemo(() => {
    if (!users) return { percentage: 0, count: 0 };
    const thisMonth = new Date().getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

    const thisMonthSignups = users.filter((u) => {
      const d = toDateValue(u.dateJoined);
      return d && d.getMonth() === thisMonth;
    }).length;
    const lastMonthSignups = users.filter((u) => {
      const d = toDateValue(u.dateJoined);
      return d && d.getMonth() === lastMonth;
    }).length;

    if (lastMonthSignups === 0) {
      return { percentage: thisMonthSignups > 0 ? 100 : 0, count: thisMonthSignups };
    }

    const percentage =
      ((thisMonthSignups - lastMonthSignups) / lastMonthSignups) * 100;
    return { percentage: Math.round(percentage), count: thisMonthSignups };
  }, [users]);


  // Get recent enrollments for the table
  const recentEnrollments = useMemo(() => {
    if (!enrollments || !users || !allCourses) return [];
    return enrollments
      .sort((a, b) => {
        const bd = toDateValue(b.enrollmentDate)?.getTime() ?? 0;
        const ad = toDateValue(a.enrollmentDate)?.getTime() ?? 0;
        return bd - ad;
      })
      .slice(0, 5)
      .map((enrollment) => {
        const user = users.find((u) => u.id === enrollment.userId);
        const course = allCourses.find((c) => c.id === enrollment.courseId);
        return {
          ...enrollment,
          userEmail: user?.email,
          courseTitle: course?.title,
        };
      });
  }, [enrollments, users, allCourses]);

  const isLoading = isUserLoading || isProfileLoading || roleLoading;
  const loadError = usersError || enrollmentsError || coursesError;
  const canView = isAdmin || isTeacher;
  const isDataLoading =
    isUsersLoading || isEnrollmentsLoading || isCoursesLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10">
          <Skeleton className="h-8 w-1/3 mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container">
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              {loadError.message || 'Failed to load dashboard data. Please try again.'}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          {canView ? (
            <>
              <div className="flex justify-between items-center mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                  {roleLabel === 'Admin'
                    ? t.adminDashboard
                    : roleLabel === 'Teacher'
                    ? t.teacherDashboard
                    : t.adminDashboard}
                </h1>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button asChild>
                      <Link href="/admin/users">{t.manageUsers}</Link>
                    </Button>
                  )}
                  <Button asChild>
                    <Link href="/admin/courses">{t.manageCourses}</Link>
                  </Button>
                </div>
              </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
            {isAdmin && (
              <StatCard
                title={t.totalRevenue}
                value={`$${totalRevenue.toFixed(2)}`}
                icon={DollarSign}
                isLoading={isDataLoading}
              />
            )}
            {isAdmin && (
              <StatCard
                title={t.totalUsers}
                value={users?.length ?? 0}
                icon={Users}
                isLoading={isDataLoading}
              />
            )}
            <StatCard
              title={t.totalEnrollments}
              value={enrollments?.length ?? 0}
              icon={BookOpen}
              isLoading={isDataLoading}
            />
            {isAdmin && (
              <StatCard
                title={t.monthlyGrowth}
                value={`${userGrowth.percentage > 0 ? '+' : ''}${userGrowth.percentage}%`}
                icon={LineChart}
                isLoading={isDataLoading}
                description={t.growthThisMonth(userGrowth.count)}
              />
            )}
          </div>

          <div className={`mt-8 grid gap-8 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.revenueByCourse}</CardTitle>
                  <CardDescription>{t.revenueByCourseDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isDataLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <RevenueChart data={revenueByCourse} />
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>{t.recentEnrollments}</CardTitle>
                <CardDescription>{t.recentEnrollmentsDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.student}</TableHead>
                      <TableHead>{t.course}</TableHead>
                      <TableHead>{t.date}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isDataLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : recentEnrollments.length > 0 ? (
                      recentEnrollments.map((enrollment) => (
                        <TableRow key={`${enrollment.userId}-${enrollment.courseId}-${enrollment.id}`}>
                          <TableCell>{enrollment.userEmail}</TableCell>
                          <TableCell>{enrollment.courseTitle}</TableCell>
                          <TableCell>
                            {(() => { const d = toDateValue(enrollment.enrollmentDate); return d ? format(d, 'PPP') : 'N/A'; })()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          {t.noRecentEnrollments}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
