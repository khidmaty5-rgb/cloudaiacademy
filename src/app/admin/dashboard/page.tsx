'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, deleteDoc, doc, getFirestore, collection, query, where } from 'firebase/firestore';
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
import { Users, BookOpen, DollarSign, LineChart } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts';
 
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import { useToast } from '@/hooks/use-toast';

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
    <Card className="min-w-0 rounded-2xl shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : (
          <>
            <div dir="auto" className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</div>
            {description && (
              <p className="mt-2 text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const dashboardText = {
  en: {
    adminDashboard: 'Academy overview',
    subtitle: 'Manage learning, people, and publishing from one place.',
    actions: 'Actions',
    removing: 'Removing…',
    unenroll: 'Unenroll',
    teacherDashboard: 'Teacher Dashboard',
    totalRevenue: 'Total Revenue',
    revenueNotConfigured: 'Revenue tracking not configured',
    totalUsers: 'Total Users',
    totalEnrollments: 'Total Enrollments',
    monthlyGrowth: 'Monthly Growth',
    enrollmentsByCourse: 'Enrollments by Course',
    enrollmentsByCourseDesc: 'A breakdown of enrollments for each course.',
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
    adminDashboard: 'نظرة عامة على الأكاديمية',
    subtitle: 'إدارة التعلّم والمستخدمين والنشر من مكان واحد.',
    actions: 'الإجراءات',
    removing: 'جارٍ الإلغاء…',
    unenroll: 'إلغاء التسجيل',
    teacherDashboard: 'لوحة تحكم المعلم',
    totalRevenue: 'إجمالي الإيرادات',
    revenueNotConfigured: 'تتبع الإيرادات غير مُهيأ',
    totalUsers: 'إجمالي المستخدمين',
    totalEnrollments: 'إجمالي التسجيلات',
    monthlyGrowth: 'النمو الشهري',
    enrollmentsByCourse: 'التسجيلات حسب الدورة',
    enrollmentsByCourseDesc: 'توزيع التسجيلات لكل دورة.',
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
  const firestore = getFirestore();
  const { isAdmin, isTeacher, loading: roleLoading } = useCurrentRole();
  const roleLabel = isAdmin ? 'Admin' : isTeacher ? 'Teacher' : null;
  const { lang } = useLang();
  const t = dashboardText[lang];
  const { toast } = useToast();
  const uid = user?.uid;
  const [unenrollingKey, setUnenrollingKey] = useState<string | null>(null);

  const handleUnenroll = async (enrollment: any) => {
    if (!isAdmin) return;
    const userId = enrollment?.userId as string | undefined;
    const courseId = enrollment?.courseId as string | undefined;
    if (!userId || !courseId) return;

    const studentLabel = (enrollment?.userEmail as string | undefined) || userId;
    const courseLabel = (enrollment?.courseTitle as string | undefined) || courseId;
    const ok =
      typeof window !== 'undefined'
        ? window.confirm(lang === 'ar' ? `هل تريد إلغاء تسجيل ${studentLabel} في ${courseLabel}؟` : `Unenroll ${studentLabel} from ${courseLabel}?`)
        : false;
    if (!ok) return;

    const key = `${userId}:${courseId}`;
    setUnenrollingKey(key);
    try {
      await deleteDoc(doc(firestore, 'users', userId, 'enrollments', courseId));
      toast({ title: lang === 'ar' ? 'تم إلغاء تسجيل الطالب.' : 'Student unenrolled.', description: `${studentLabel} — ${courseLabel}` });
    } catch (e) {
      console.error('[AdminUnenroll]', e);
      const code = (e as any)?.code as string | undefined;
      const msg =
        code === 'permission-denied'
          ? (lang === 'ar' ? 'ليس لديك صلاحية لإلغاء هذا التسجيل.' : 'You do not have permission to remove this enrollment.')
          : (lang === 'ar' ? 'تعذّر إلغاء التسجيل.' : 'Failed to unenroll.');
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setUnenrollingKey((k) => (k === key ? null : k));
    }
  };

  // Fetch all users for total user count and growth calculation (admin-only)
  const canListUsers = isAdmin;

  const usersQuery = useMemoFirebase(
    () => (canListUsers ? collection(firestore, 'users') : null),
    [firestore, canListUsers]
  );
  const { data: users, isLoading: isUsersLoading, error: usersError } = useCollection(usersQuery);

  const adminCoursesQuery = useMemoFirebase(
    () => (isAdmin ? collection(firestore, 'courses') : null),
    [firestore, isAdmin]
  );
  const teacherOwnedCoursesQuery = useMemoFirebase(
    () =>
      isTeacher && uid
        ? query(collection(firestore, 'courses'), where('ownerId', '==', uid))
        : null,
    [firestore, isTeacher, uid]
  );
  const teacherAssignedCoursesQuery = useMemoFirebase(
    () =>
      isTeacher && uid
        ? query(collection(firestore, 'courses'), where('instructorIds', 'array-contains', uid))
        : null,
    [firestore, isTeacher, uid]
  );

  const {
    data: adminCourses,
    isLoading: isAdminCoursesLoading,
    error: adminCoursesError,
  } = useCollection(adminCoursesQuery);
  const {
    data: teacherOwnedCourses,
    isLoading: isTeacherOwnedCoursesLoading,
    error: teacherOwnedCoursesError,
  } = useCollection(teacherOwnedCoursesQuery);
  const {
    data: teacherAssignedCourses,
    isLoading: isTeacherAssignedCoursesLoading,
    error: teacherAssignedCoursesError,
  } = useCollection(teacherAssignedCoursesQuery);

  const allCourses = useMemo(() => {
    if (isAdmin) return adminCourses;
    if (isTeacher) {
      const map = new Map<string, any>();
      for (const c of teacherOwnedCourses || []) map.set(c.id, c);
      for (const c of teacherAssignedCourses || []) map.set(c.id, c);
      return Array.from(map.values());
    }
    return null;
  }, [isAdmin, isTeacher, adminCourses, teacherOwnedCourses, teacherAssignedCourses]);

  const isCoursesLoading = isAdmin
    ? isAdminCoursesLoading
    : isTeacher
    ? isTeacherOwnedCoursesLoading || isTeacherAssignedCoursesLoading
    : false;

  const coursesError =
    adminCoursesError || teacherOwnedCoursesError || teacherAssignedCoursesError;

  const teacherCourseIds = useMemo(() => {
    if (!isTeacher || !allCourses) return [] as string[];
    return allCourses.map((c) => c.id).filter(Boolean).sort();
  }, [isTeacher, allCourses]);

  const teacherTooManyCourses = isTeacher && teacherCourseIds.length > 10;

  // Fetch enrollments for total enrollment count and recent enrollments
  const enrollmentsQuery = useMemoFirebase(() => {
    if (isAdmin) {
      return query(collectionGroup(firestore, 'enrollments'));
    }

    if (isTeacher) {
      // Firestore `in` supports up to 10 values.
      if (teacherTooManyCourses) return null;
      if (teacherCourseIds.length === 0) return null;
      return query(
        collectionGroup(firestore, 'enrollments'),
        where('courseId', 'in', teacherCourseIds)
      );
    }

    return null;
  }, [firestore, isAdmin, isTeacher, teacherTooManyCourses, teacherCourseIds]);
  const {
    data: enrollments,
    isLoading: isEnrollmentsLoading,
    error: enrollmentsError,
  } = useCollection(enrollmentsQuery);

  // Calculate enrollments by course for the chart (replace fake revenue)
  const enrollmentsByCourse = useMemo(() => {
    if (!enrollments || !allCourses) return [] as Array<{ name: string; count: number }>;

    const courseTitleById = new Map<string, string>();
    for (const c of allCourses) {
      courseTitleById.set(c.id, c.title ?? c.id);
    }

    const countsByCourseId = new Map<string, number>();
    for (const e of enrollments) {
      const courseId = e.courseId;
      countsByCourseId.set(courseId, (countsByCourseId.get(courseId) ?? 0) + 1);
    }

    return Array.from(countsByCourseId.entries()).map(([courseId, count]) => ({
      name: courseTitleById.get(courseId) ?? courseId,
      count,
    }));
  }, [enrollments, allCourses]);

  // Calculate user growth percentage
  const userGrowth = useMemo(() => {
    if (!users) return { percentage: 0, count: 0 };
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const thisMonthSignups = users.filter((u) => {
      const d = toDateValue(u.dateJoined);
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const lastMonthSignups = users.filter((u) => {
      const d = toDateValue(u.dateJoined);
      return d && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
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
    if (!enrollments || !allCourses) return [];

    const userEmailById = new Map<string, string | undefined>();
    for (const u of users || []) {
      userEmailById.set(u.id, (u as any).email);
    }

    const courseTitleById = new Map<string, string>();
    for (const c of allCourses) {
      courseTitleById.set(c.id, c.title ?? c.id);
    }

    return [...enrollments]
      .sort((a, b) => {
        const bd = toDateValue(b.enrollmentDate)?.getTime() ?? 0;
        const ad = toDateValue(a.enrollmentDate)?.getTime() ?? 0;
        return bd - ad;
      })
      .slice(0, 5)
      .map((enrollment) => {
        return {
          ...enrollment,
          userEmail: userEmailById.get(enrollment.userId) ?? (enrollment as any).userEmail,
          courseTitle: courseTitleById.get(enrollment.courseId),
        };
      });
  }, [enrollments, users, allCourses]);

  const isLoading = isUserLoading || roleLoading;
  const teacherCourseLimitError =
    teacherTooManyCourses
      ? new Error(
          `Teacher dashboard currently supports up to 10 courses (found ${teacherCourseIds.length}).`
        )
      : null;
  const loadError =
    usersError || enrollmentsError || coursesError || teacherCourseLimitError;
  const canView = isAdmin || isTeacher;
  const isDataLoading =
    isUsersLoading || isEnrollmentsLoading || isCoursesLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
        <main className="flex-1 container py-10">
          <Skeleton className="h-8 w-1/3 mb-8" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
        <main className="flex-1 py-6 md:py-8">
          <div className="container">
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              {loadError.message || 'Failed to load dashboard data. Please try again.'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
      <main className="flex-1 py-6 md:py-8">
        <div className="container">
          {canView ? (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
                <div><h1 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">
                  {roleLabel === 'Admin'
                    ? t.adminDashboard
                    : roleLabel === 'Teacher'
                    ? t.teacherDashboard
                    : t.adminDashboard}
                </h1><p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p></div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/admin/users">{t.manageUsers}</Link>
                    </Button>
                  )}
                  <Button asChild className="rounded-xl">
                    <Link href={isTeacher && !isAdmin ? '/teacher/courses' : '/admin/courses'}>
                      {isTeacher && !isAdmin ? (lang === 'ar' ? 'دوراتي' : 'My Courses') : t.manageCourses}
                    </Link>
                  </Button>
                </div>
              </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 mt-8">
            {isAdmin && (
              <StatCard
                title={t.totalRevenue}
                value={'—'}
                icon={DollarSign}
                isLoading={isDataLoading}
                description={t.revenueNotConfigured}
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

          <div className={`mt-6 grid gap-6 ${isAdmin ? '2xl:grid-cols-2' : 'grid-cols-1'}`}>
            {isAdmin && (
              <Card className="min-w-0 rounded-2xl shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">{t.enrollmentsByCourse}</CardTitle>
                  <CardDescription>{t.enrollmentsByCourseDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isDataLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ChartContainer
                      className="h-[260px] w-full sm:h-[300px]"
                      config={{ count: { label: t.totalEnrollments, color: 'hsl(var(--accent))' } }}
                    >
                      <RechartsBarChart data={enrollmentsByCourse} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <XAxis
                          dataKey="name"
                          stroke="#888888"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value: string) => value.slice(0, 15) + (value.length > 15 ? '...' : '')}
                        />
                        <YAxis
                          stroke="#888888"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value: number) => `${value}`}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )}
            <Card className="min-w-0 rounded-2xl shadow-none">
              <CardHeader>
                <CardTitle className="text-lg">{t.recentEnrollments}</CardTitle>
                <CardDescription>{t.recentEnrollmentsDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t.student}</TableHead>
                      <TableHead className="text-start">{t.course}</TableHead>
                      <TableHead className="text-start">{t.date}</TableHead>
                      {isAdmin && <TableHead className="text-end">{t.actions}</TableHead>}
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
                          {isAdmin && (
                            <TableCell className="text-end">
                              <Skeleton className="h-9 w-24 ms-auto" />
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : recentEnrollments.length > 0 ? (
                      recentEnrollments.map((enrollment) => (
                        <TableRow key={`${enrollment.userId}-${enrollment.courseId}-${enrollment.id}`}>
                          <TableCell className="max-w-56 break-words"><bdi>{enrollment.userEmail || enrollment.userId}</bdi></TableCell>
                          <TableCell className="min-w-36"><bdi>{enrollment.courseTitle}</bdi></TableCell>
                          <TableCell>
                            {(() => { const d = toDateValue(enrollment.enrollmentDate); return d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(d) : '—'; })()}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleUnenroll(enrollment)}
                                disabled={unenrollingKey === `${enrollment.userId}:${enrollment.courseId}`}
                              >
                                {unenrollingKey === `${enrollment.userId}:${enrollment.courseId}`
                                  ? t.removing
                                  : t.unenroll}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} className="text-center">
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
    </div>
  );
}
