'use client';

import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Recommendations from '@/components/dashboard/recommendations';
import { collection, getFirestore, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import { Clock, Signal, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import AnnouncementsFeed from '@/components/dashboard/announcements-feed';
import type { Course, Enrollment, LearningPath } from '@/types/models';
import { useLang } from '@/components/i18n/lang';

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
} as const;

type DashboardText = typeof dashboardCopy.en;

function EnrolledCourses({ t }: { t: DashboardText }) {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();

  const enrollmentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'enrollments');
  }, [firestore, user]);

  const { data: enrollments, isLoading: enrollmentsLoading } = useCollection<Enrollment>(enrollmentsQuery);
  
  const enrolledCourseIds = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.map(e => e.id);
  }, [enrollments]);

  const [largeSetCourses, setLargeSetCourses] = useState<Course[] | null>(null);
  const [largeSetLoading, setLargeSetLoading] = useState(false);

  const useRealtime = enrolledCourseIds.length > 0 && enrolledCourseIds.length <= 10;

  const coursesQuery = useMemoFirebase(() => {
    if (!useRealtime) return null;
    return query(collection(firestore, 'courses'), where('id', 'in', enrolledCourseIds));
  }, [firestore, useRealtime, enrolledCourseIds]);


  const { data: realtimeCourses, isLoading: coursesLoading } = useCollection<Course>(coursesQuery);

  // Fallback for >10 ids
  useEffect(() => {
    let cancelled = false;
    async function fetchLarge() {
      if (useRealtime || enrolledCourseIds.length === 0) {
        setLargeSetCourses(null);
        setLargeSetLoading(false);
        return;
      }
      setLargeSetLoading(true);
      const chunks: string[][] = [];
      for (let i = 0; i < enrolledCourseIds.length; i += 10) {
        chunks.push(enrolledCourseIds.slice(i, i + 10));
      }
      const results: Course[] = [];
      for (const c of chunks) {
        const q = query(collection(firestore, 'courses'), where('id', 'in', c));
        const snap = await getDocs(q);
        snap.forEach(d => results.push({ id: d.id, ...(d.data() as Course) }));
      }
      if (!cancelled) {
        setLargeSetCourses(results);
        setLargeSetLoading(false);
      }
    }
    fetchLarge();
    return () => { cancelled = true };
  }, [firestore, useRealtime, enrolledCourseIds]);

  const allCourses = useMemo(() => {
    if (useRealtime) return realtimeCourses || [];
    return largeSetCourses || [];
  }, [useRealtime, realtimeCourses, largeSetCourses]);

  const enrolledCourses = useMemo(() => {
    if (!enrollments || !allCourses) return [];
    return allCourses
      .map(course => {
        const enrollment = enrollments.find(e => e.id === course.id);
        if (enrollment) {
          return { ...course, progress: enrollment.progress || 0 };
        }
        return null;
      })
      .filter(Boolean);
  }, [enrollments, allCourses]);

  if (enrollmentsLoading || isUserLoading || (useRealtime ? coursesLoading : largeSetLoading)) {
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
            if (!course) return null;
             const image = getPlaceholderImage(course.imageId);
            return (
            <Link href={`/learn/${course.slug}`} key={course.id}>
                <Card  className="overflow-hidden group hover:shadow-lg transition-shadow duration-300 h-full">
                <CardHeader className="p-0">
                    <div className="relative h-48 w-full">
                    {image && (
                        <Image
                        src={image.imageUrl}
                        alt={course.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        data-ai-hint={image.imageHint}
                        />
                    )}
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

  const { data: learningPaths, isLoading: pathsLoading } = useCollection<LearningPath>(learningPathsQuery);
  
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
        const tr = await user.getIdTokenResult(true);
        const role = (tr.claims as any)?.role;
        if (!cancelled && (role === 'admin' || role === 'teacher')) {
          router.replace('/admin/dashboard');
        }
      } catch {}
    })();
    return () => { cancelled = true };
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-10">
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <div className="grid gap-8 md:grid-cols-2">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    
        <div className="container py-10">
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
