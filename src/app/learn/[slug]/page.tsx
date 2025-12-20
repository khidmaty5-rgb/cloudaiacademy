'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getFirestore, collection, query, orderBy } from 'firebase/firestore';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Lock } from 'lucide-react';
import Link from 'next/link';
import type { Lesson } from '@/lib/lessons';
import { enrollInCourse } from '@/lib/enrollment';

export default function LearnCoursePage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userDocRef);
  const { isAdmin, isTeacher, isStudent: isStudentRole } = useCurrentRole();
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) { if (!cancelled) setHasAdminOrTeacherClaim(false); return; }
      try {
        const tr = await user.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        const allowed = role === 'admin' || role === 'teacher';
        if (!cancelled) setHasAdminOrTeacherClaim(allowed);
      } catch { if (!cancelled) setHasAdminOrTeacherClaim(false); }
    }
    checkClaims();
    return () => { cancelled = true };
  }, [user]);
  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) { setHasAdminOrTeacherClaim(false); return; }
      try {
        const tr = await u.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        setHasAdminOrTeacherClaim(role === 'admin' || role === 'teacher');
      } catch { setHasAdminOrTeacherClaim(false); }
    });
    return () => unsub();
  }, []);
  // Treat teacher-not-instructor as student for learn access unless admin or instructor
  const isStudent = isStudentRole && hasAdminOrTeacherClaim !== true;
  const studentPaymentRequired = isStudent && userProfile?.requirePayment === true;

  const courseDocRef = useMemoFirebase(() => {
    if (!slug) return null;
    return doc(firestore, 'courses', slug);
  }, [firestore, slug]);
  const { data: course, isLoading: isCourseLoading } = useDoc(courseDocRef);

  const enrollmentDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'enrollments', course.id);
  }, [firestore, user, course]);
  
  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc(enrollmentDocRef);
  const isEnrolled = !!enrollment;

  const lessonsQuery = useMemoFirebase(() => {
    if (!course) return null;
    const uid = user?.uid;
    const isCourseInstructor = !!(uid && course && ((course.ownerId === uid) || ((course.instructorIds || []).includes(uid))));
    const canPreviewCourse = !!(isAdmin || (isTeacher && isCourseInstructor));
    const canAccessCourseContent = !!(isEnrolled || canPreviewCourse);
    if (!canAccessCourseContent) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course, user, isAdmin, isTeacher, isEnrolled]);
  const { data: courseLessons, isLoading: areLessonsLoading } = useCollection<Lesson>(lessonsQuery);

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (enrollment) {
      setCompletedLessons(enrollment.completedLessons || []);
    }
  }, [enrollment]);
  
  useEffect(() => {
    // Wait until all loading is finished; no navigation here to avoid loops
    if (isUserLoading || isEnrollmentLoading || isCourseLoading) return;
  }, [isUserLoading, isEnrollmentLoading, isCourseLoading]);


  const uid = user?.uid;
  const isCourseInstructor = !!(uid && course && ((course.ownerId === uid) || (course.instructorIds || []).includes(uid)));
  const canPreviewCourse = !!(isAdmin || (isTeacher && isCourseInstructor));
  const canAccessCourseContent = !!(isEnrolled || canPreviewCourse);
  const isLoading = isUserLoading || isEnrollmentLoading || isCourseLoading || areLessonsLoading;

  if (isLoading) {
    return (
       <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
            <div className='max-w-3xl mx-auto'>
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-6" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
        </main>
        <Footer />
       </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>Login required</CardTitle>
                <CardDescription>Please login to view course content.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login" className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block">Go to Login</Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <p className="text-muted-foreground">Course not found.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // enrollment fallback shown before checking lessons
  const handleEnroll = async () => {
    if (!user || !course) return;
    if (studentPaymentRequired) { window.location.assign('/#pricing'); return; }
    try {
      setEnrolling(true);
      await enrollInCourse(user.uid, course.id);
    } finally {
      setEnrolling(false);
    }
  };

  if (studentPaymentRequired && !canPreviewCourse) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-destructive/30 bg-destructive/10">
              <CardHeader>
                <CardTitle>Payment required</CardTitle>
                <CardDescription>Please complete payment to access this course.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/#pricing" className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block">View Plans</Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!canAccessCourseContent && !studentPaymentRequired) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>Enroll to access this course</CardTitle>
                <CardDescription>You need to enroll before viewing lessons.</CardDescription>
              </CardHeader>
              <CardContent>
                <button disabled={enrolling} onClick={handleEnroll} className="px-4 py-2 rounded bg-accent text-accent-foreground">
                  {enrolling ? 'Enrolling…' : 'Enroll Now'}
                </button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!courseLessons) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <p className="text-muted-foreground">No lessons found for this course.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const progress = courseLessons.length > 0 ? Math.round((completedLessons.length / courseLessons.length) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-3xl mx-auto">
          <h1 className="font-headline text-3xl md:text-4xl font-bold">{course.title}</h1>
          <div className="mt-4">
            <div className='flex justify-between items-center mb-1'>
                 <p className="text-sm text-muted-foreground">Course Progress</p>
                 <p className="text-sm font-bold text-accent">{progress}%</p>
            </div>
            <Progress value={progress} className="h-2 bg-muted" />
          </div>

          <Card className="mt-8 border-accent">
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>Complete each lesson to finish the course.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {courseLessons.map((lesson, index) => {
                  const isCompleted = completedLessons.includes(lesson.id);
                  const isLocked = index > 0 && !completedLessons.includes(courseLessons[index - 1].id) && !canPreviewCourse;

                  return (
                    <li key={lesson.id}>
                      <Link href={isLocked ? '#' : `/learn/${slug}/${lesson.id}`} className={`block ${isLocked ? 'pointer-events-none' : ''}`}>
                        <div
                            className={`flex items-center justify-between p-4 rounded-lg border-l-4 transition-colors ${
                                isCompleted ? 'bg-green-500/10 border-green-500' : 'bg-muted/50 border-accent'
                            } ${isLocked ? 'opacity-50 ' : 'hover:bg-accent/10'}`}
                        >
                            <div className="flex items-center gap-4">
                                {isCompleted ? (
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                ) : isLocked ? (
                                     <Lock className="h-6 w-6 text-muted-foreground" />
                                ) : (
                                    <Circle className="h-6 w-6 text-muted-foreground" />
                                )}
                                <span className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>{lesson.title}</span>
                            </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
