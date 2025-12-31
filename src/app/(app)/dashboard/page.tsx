'use client';

import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Recommendations from '@/components/dashboard/recommendations';
import { collection, doc, getDoc, getFirestore } from 'firebase/firestore';
import Image from 'next/image';
import { getCourseImage } from '@/lib/course-images';
import { Badge } from '@/components/ui/badge';
import { Clock, Signal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import AnnouncementsFeed from '@/components/dashboard/announcements-feed';
import type { Course, Enrollment, LearningPath } from '@/types/models';
import { useLang } from '@/components/i18n/lang';

type DashboardText = {
  noEnrollments: string;
  exploreCourses: string;
  progress: string;
  noLearningPaths: string;
  createLearningPath: string;
  welcome: (name: string) => string;
  defaultName: string;
  startLearning: string;
  myCourses: string;
  myLearningPaths: string;
  aiRecommendations: string;
};

const dashboardCopy = {
  en: {
    noEnrollments: "You haven't enrolled in any courses yet.",
    exploreCourses: 'Explore Courses',
    progress: 'Progress',
    noLearningPaths: "You haven't saved any learning paths yet.",
    createLearningPath: 'Create One Now',
    welcome: (name: string) => `Welcome, ${name}!`,
    defaultName: 'User',
    startLearning: "Let’s start learning.",
    myCourses: 'My Courses',
    myLearningPaths: 'My Learning Paths',
    aiRecommendations: 'AI Recommendations',
  },
  ar: {
    noEnrollments: 'لم تسجّل في أي دورة بعد.',
    exploreCourses: 'استكشف الدورات',
    progress: 'التقدم',
    noLearningPaths: 'لم تحفظ أي مسارات تعلم بعد.',
    createLearningPath: 'أنشئ واحدًا الآن',
    welcome: (name: string) => `مرحبًا، ${name}!`,
    defaultName: 'مستخدم',
    startLearning: 'لنبدأ التعلم.',
    myCourses: 'دوراتي',
    myLearningPaths: 'مسارات التعلم الخاصة بي',
    aiRecommendations: 'توصيات الذكاء الاصطناعي',
  },
} satisfies Record<'en' | 'ar', DashboardText>;

function EnrolledCourses({ t }: { t: DashboardText }) {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'enrollments');
  }, [firestore, user]);

  const { data: enrollments, isLoading: enrollmentsLoading, error: enrollmentsError } = useCollection<Enrollment>(enrollmentsQuery);
  
  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.map(e => e.id);
  }, [enrollments]);

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCourses() {
      if (!user) {
        setCourses(null);
        setCoursesLoading(false);
        setCoursesError(null);
        return;
      }
      if (enrolledCourseIds.length === 0) {
        setCourses([]);
        setCoursesLoading(false);
        setCoursesError(null);
        return;
      }

      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const results = await Promise.all(
          enrolledCourseIds.map(async (courseId) => {
            const snap = await getDoc(doc(firestore, 'courses', courseId));
            if (!snap.exists()) return null;
            const data = snap.data() as Course;
            return { ...(data as any), id: snap.id } as Course;
          }),
        );
        if (!cancelled) {
          setCourses(results.filter(Boolean) as Course[]);
          setCoursesLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setCoursesError(err instanceof Error ? err : new Error('Failed to load your courses.'));
          setCourses([]);
          setCoursesLoading(false);
        }
      }
    }
    fetchCourses();
    return () => { cancelled = true };
  }, [firestore, user, enrolledCourseIds]);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !courses) return [];
    const enrollmentByCourseId = new Map(enrollments.map(enrollment => [enrollment.id, enrollment]));
    return courses
      .map((course) => {
        const enrollment = enrollmentByCourseId.get(course.id);
        if (!enrollment) return null;
        const progressRaw = Number(enrollment.progress ?? 0);
        const progress = Number.isFinite(progressRaw) ? Math.min(100, Math.max(0, progressRaw)) : 0;
        return { ...course, progress };
      })
      .filter((course): course is Course & { progress: number } => !!course);
  }, [enrollments, courses]);

  if (enrollmentsError || coursesError) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        {enrollmentsError?.message || coursesError?.message || 'Failed to load your courses.'}
      </div>
    );
  }

  if (enrollmentsLoading || isUserLoading || coursesLoading) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
  }

  if (enrolledCourses.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground mb-4">
            {t.noEnrollments}
            </p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/courses">{t.exploreCourses}</Link>
            </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {enrolledCourses.map(course => {
             const image = getCourseImage(course as any);
             const isContain = image.fit === 'contain';
            return (
            <Link href={`/learn/${course.slug}`} key={course.id}>
                <Card  className="overflow-hidden group hover:shadow-lg transition-shadow duration-300 h-full">
                <CardHeader className="p-0">
                    <div className="relative h-48 w-full bg-white">
                    <div className={`absolute inset-0 ${isContain ? 'p-6' : ''}`}>
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
                <CardContent className="p-4 flex flex-col h-full">
                    <Badge variant="secondary" className="bg-accent/10 text-accent mb-2 w-fit">{course.category}</Badge>
                    <h3 className="font-headline text-lg font-bold flex-grow">{course.title}</h3>
                     <div className="flex justify-between text-muted-foreground text-sm mt-2 border-t pt-2">
                        <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {course.duration}
                        </div>
                        <div className="flex items-center gap-2">
                        <Signal className="w-4 h-4" /> {course.level}
                        </div>
                    </div>
                    <div className='mt-4'>
                        <div className='flex justify-between items-center mb-1'>
                             <p className="text-sm text-muted-foreground">{t.progress}</p>
                             <p className="text-sm font-bold text-accent">{course.progress}%</p>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                    </div>
                </CardContent>
                </Card>
            </Link>
        )})}
    </div>
  )

}

function SavedLearningPaths({ t }: { t: DashboardText }) {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();

  const learningPathsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'learningPaths');
  }, [firestore, user]);

  const { data: learningPaths, isLoading: pathsLoading, error: pathsError } = useCollection<LearningPath>(learningPathsQuery);
  
  if (pathsError) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        {pathsError.message || 'Failed to load learning paths.'}
      </div>
    );
  }

  if (pathsLoading || isUserLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!learningPaths || learningPaths.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center text-center p-10 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground mb-4">
            {t.noLearningPaths}
            </p>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/learning-path">{t.createLearningPath}</Link>
            </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {learningPaths.map(path => (
        <Card key={path.id} className='bg-background/50'>
          <CardHeader>
            <CardTitle className='font-headline text-lg'>{path.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground text-sm'>{path.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )

}


export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { lang } = useLang();
  const t = dashboardCopy[lang];

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (isUserLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const tr = await user.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        if (cancelled) return;
        if (role === 'admin') {
          router.replace('/admin/dashboard');
          return;
        }
        if (role === 'teacher') {
          router.replace('/teacher/dashboard');
          return;
        }
        if (role === 'editor') {
          router.replace('/admin/journal');
          return;
        }
      } catch {}
    })();
    return () => { cancelled = true };
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="w-full max-w-6xl px-4 py-10 md:px-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    
        <div className="w-full max-w-6xl px-4 py-10 md:px-6">
          <h1 className="font-headline text-3xl md:text-4xl font-bold">
            {t.welcome(user.displayName || t.defaultName)}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {t.startLearning}
          </p>

          <div className="mt-8 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-10">
                 <div>
                    <AnnouncementsFeed />
                </div>
                <div>
                  <h2 className="text-2xl font-headline font-bold mb-4">{t.myCourses}</h2>
                  <EnrolledCourses t={t} />
                </div>
                <div>
                  <h2 className="text-2xl font-headline font-bold mb-4">{t.myLearningPaths}</h2>
                  <SavedLearningPaths t={t} />
                </div>
            </div>

            <div className="lg:col-span-1">
                <h2 className="text-2xl font-headline font-bold mb-4">{t.aiRecommendations}</h2>
                <Card>
                    <CardContent className="pt-6">
                        <Recommendations />
                    </CardContent>
                </Card>
            </div>
          </div>
        </div>
      
  );
}
