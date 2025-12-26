'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getCourseImage } from '@/lib/course-images';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { enrollInCourse } from '@/lib/enrollment';
import { cancelEnrollmentRequest, requestEnrollment } from '@/lib/enrollment-requests';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Clock, Signal } from 'lucide-react';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import type { Lesson } from '@/lib/lessons';
import type { Course, Enrollment, EnrollmentRequest } from '@/types/models';
import { Skeleton } from '@/components/ui/skeleton';
import { useLang } from '@/components/i18n/lang';
import LiveSessionButton from '@/components/LiveSessionButton';

const courseCopy = {
  en: {
    courseNotFound: 'Course not found.',
    goToCourse: 'Go to Course',
    enrollNow: 'Enroll Now',
    enrollSuccess: 'Successfully Enrolled!',
    enrollSuccessDesc: (title: string) => `You have enrolled in ${title}.`,
    enrollFailed: 'Enrollment Failed',
    enrollFailedDesc: 'There was an error enrolling in the course.',
    startLive: 'Start Live Class',
  },
  ar: {
    courseNotFound: 'Course not found.',
    goToCourse: 'Go to Course',
    enrollNow: 'Enroll Now',
    enrollSuccess: 'Successfully Enrolled!',
    enrollSuccessDesc: (title: string) => `You have enrolled in ${title}.`,
    enrollFailed: 'Enrollment Failed',
    enrollFailedDesc: 'There was an error enrolling in the course.',
    startLive: 'بدء الحصة المباشرة',
  },
} as const;

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { lang } = useLang();
  const t = courseCopy[lang];
  const { isAdmin, isTeacher } = useCurrentRole();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userDocRef);
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

  const isStudent = ((userProfile?.role as string | undefined) || 'student') === 'student' && hasAdminOrTeacherClaim !== true;
  const studentPaymentRequired = isStudent && userProfile?.requirePayment === true;
  

  const courseDocRef = useMemoFirebase(() => {
      if (!slug) return null;
      return doc(firestore, 'courses', slug);
  }, [firestore, slug]);

  const { data: course, isLoading: isCourseLoading } = useDoc<Course>(courseDocRef);

  const enrollmentDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'enrollments', course.id);
  }, [firestore, user, course]);

  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc<Enrollment>(enrollmentDocRef);

  const enrollmentRequestDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'enrollmentRequests', course.id);
  }, [firestore, user, course]);
  const { data: enrollmentRequest, isLoading: isEnrollmentRequestLoading } = useDoc<EnrollmentRequest>(
    enrollmentRequestDocRef,
  );

  const isEnrolled = !!enrollment;
  const isLoading = isUserLoading || isCourseLoading || isEnrollmentLoading || isEnrollmentRequestLoading;

  const image = course ? getCourseImage(course as any) : undefined;

  const uid = user?.uid;
  const isCourseInstructor = !!(uid && course && ((course.ownerId === uid) || (course.instructorIds || []).includes(uid)));
  const canPreviewCourse = !!(isAdmin || (isTeacher && isCourseInstructor));
  const canAccessCourseContent = !!(isEnrolled || canPreviewCourse);
  const canJoinLive = !!(isCourseInstructor || isEnrolled);

  const lessonsQuery = useMemoFirebase(() => {
    if (!course || !canAccessCourseContent) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course, canAccessCourseContent]);
  const { data: lessons } = useCollection<Lesson>(lessonsQuery);
  const firstLessonId = lessons && lessons.length > 0 ? lessons[0].id : null;

  // Do not redirect during render lifecycle; instead show a friendly fallback below if not found

  const isWaitlistPending = enrollmentRequest?.status === 'PENDING';
  const isWaitlistApproved = enrollmentRequest?.status === 'APPROVED';
  const isWaitlistRejected = enrollmentRequest?.status === 'REJECTED';
  const [isWaitlistSaving, setIsWaitlistSaving] = useState(false);
  const courseIsFull = course?.isFull === true;

  const handleEnroll = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
      return;
    }
    if (!course) return;

    try {
      setIsWaitlistSaving(true);

      if (!courseIsFull) {
        if (studentPaymentRequired && !canPreviewCourse) {
          window.location.assign('/#pricing');
          return;
        }

        await enrollInCourse(user.uid, course.id);
        // If the course was previously full, clean up any old request doc.
        await cancelEnrollmentRequest(user.uid, course.id);
        toast({
          title: t.enrollSuccess,
          description: t.enrollSuccessDesc(course.title),
        });
        if (firstLessonId) {
          router.push(`/learn/${slug}/${firstLessonId}`);
        } else {
          router.push(`/learn/${slug}`);
        }
        return;
      }

      if (isWaitlistApproved) {
        await enrollInCourse(user.uid, course.id);
        await cancelEnrollmentRequest(user.uid, course.id);
        toast({
          title: t.enrollSuccess,
          description: t.enrollSuccessDesc(course.title),
        });
        if (firstLessonId) {
          router.push(`/learn/${slug}/${firstLessonId}`);
        } else {
          router.push(`/learn/${slug}`);
        }
        return;
      }

      await requestEnrollment({
        userId: user.uid,
        courseId: course.id,
        courseTitle: course.title,
        courseCode: course.courseCode || null,
      });
      toast({
        title: 'Added to waiting list',
        description: 'We will review your request and approve your enrollment soon.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.enrollFailed,
        description: error.message || t.enrollFailedDesc,
      });
    } finally {
      setIsWaitlistSaving(false);
    }
  };

  // no teacher self-assign; admin assigns instructors in Admin → Courses

  if (isLoading) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
            <div className="container py-10 md:py-16">
              <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                <Skeleton className="h-96 w-full" />
                <div className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
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
        <main className="flex-1">
          <div className="container py-10 md:py-16">
            <p className="text-muted-foreground">{t.courseNotFound}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <div
                className="relative w-full rounded-lg overflow-hidden shadow-lg bg-white"
                style={{ aspectRatio: '3/2' }}
              >
                {image &&
                  (image.fit === 'contain' ? (
                    <div className="absolute inset-0 p-10">
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
                  ))}
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <Badge variant="secondary" className="bg-accent/10 text-accent w-fit mb-2">{course.category}</Badge>
              <h1 className="font-headline text-3xl md:text-4xl font-bold">{course.title}</h1>
              <p className="mt-4 text-lg text-muted-foreground">{course.description}</p>
              
              <div className="flex items-center gap-6 text-muted-foreground mt-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {course.duration}
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="w-4 h-4" /> {course.level}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-3xl font-bold text-accent">{course.price}</p>
              </div>

              <div className="mt-8">
                {studentPaymentRequired && (
                  <p className="mb-4 text-sm text-destructive">Payment is required to access lessons.</p>
                )}
                {courseIsFull && isWaitlistPending && !canAccessCourseContent && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    Your request is pending approval. You will be able to start once approved.
                  </p>
                )}
                {courseIsFull && isWaitlistRejected && !canAccessCourseContent && (
                  <p className="mb-4 text-sm text-destructive">
                    Your request was rejected. You can request again if you think this is a mistake.
                  </p>
                )}
                {canAccessCourseContent ? (
                    <Button
                      size="lg"
                      className="w-full md:w-auto bg-green-500 hover:bg-green-600 flex items-center gap-2"
                      onClick={() => {
                        if (firstLessonId) {
                          router.push(`/learn/${slug}/${firstLessonId}`);
                        } else {
                          router.push(`/learn/${slug}`);
                        }
                      }}
                    >
                      {t.goToCourse}
                    </Button>
                ) : (
                    <Button
                      onClick={handleEnroll}
                      size="lg"
                      disabled={isWaitlistSaving || (courseIsFull && isWaitlistPending) || (!courseIsFull && studentPaymentRequired && !canPreviewCourse)}
                      className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-60"
                    >
                        {!courseIsFull
                          ? studentPaymentRequired && !canPreviewCourse
                            ? 'Payment required'
                            : isWaitlistSaving
                              ? 'Enrolling...'
                              : t.enrollNow
                          : isWaitlistApproved
                            ? 'Start Course'
                            : isWaitlistPending
                              ? 'On Waiting List'
                              : isWaitlistRejected
                                ? 'Request Again'
                                : 'Join Waiting List'}
                    </Button>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {isCourseInstructor && (
                    <LiveSessionButton course={course as any} label={t.startLive} />
                  )}
                  {!isCourseInstructor && isEnrolled && (
                    <LiveSessionButton course={course as any} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
