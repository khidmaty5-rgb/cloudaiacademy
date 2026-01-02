'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getFirestore, collection, query, orderBy } from 'firebase/firestore';
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
import { cancelEnrollmentRequest, requestEnrollment } from '@/lib/enrollment-requests';
import type { EnrollmentRequest } from '@/types/models';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_PAYMENT_SETTINGS, sanitizePaymentSettings } from '@/lib/payment-settings';
import { studentRequiresPayment } from '@/lib/payment-gate';
import { roleFromClaims } from '@/lib/roles';
import { startCourseCheckout } from '@/lib/course-checkout';
import { isPriceFree } from '@/lib/course-price';

export default function LearnCoursePage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = getFirestore();
  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);
  const { role, loading: roleLoading, isAdmin, isTeacher } = useCurrentRole();
  const isStudent = !!user && !roleLoading && role === 'student';
  const paymentDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'payment'), [firestore]);
  const { data: paymentDoc, isLoading: isPaymentLoading } = useDoc(paymentDocRef);
  const paymentSettings = useMemo(
    () => sanitizePaymentSettings(paymentDoc, DEFAULT_PAYMENT_SETTINGS),
    [paymentDoc],
  );
  const perCourseCheckoutAvailable =
    paymentSettings.enabled && paymentSettings.provider === 'stripe' && paymentSettings.model === 'per_course';
  const studentAccountRequiresPayment =
    isStudent && studentRequiresPayment(paymentSettings, userProfile as any);

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

  const coursePurchaseDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'coursePurchases', course.id);
  }, [firestore, user, course]);
  const { data: coursePurchase, isLoading: isPurchaseLoading } =
    useDoc<Record<string, unknown>>(coursePurchaseDocRef);
  const hasCoursePurchase = !!coursePurchase;

  const enrollmentRequestDocRef = useMemoFirebase(() => {
    if (!user || !course) return null;
    return doc(firestore, 'users', user.uid, 'enrollmentRequests', course.id);
  }, [firestore, user, course]);
  const { data: enrollmentRequest, isLoading: isEnrollmentRequestLoading } = useDoc<EnrollmentRequest>(
    enrollmentRequestDocRef,
  );

  const uid = user?.uid;
  const isCourseInstructor = !!(uid && course && ((course.ownerId === uid) || (course.instructorIds || []).includes(uid)));
  const canPreviewCourse = !!(isAdmin || (isTeacher && isCourseInstructor));
  const canEvaluateStudentAccess =
    !roleLoading && !isProfileLoading && !isPaymentLoading && !isEnrollmentLoading && !isPurchaseLoading;
  const courseIsFree = !!(course && isPriceFree((course as any)?.price));
  const coursePaymentRequired = !!(
    isStudent &&
    !canPreviewCourse &&
    paymentSettings.paywall.enabled &&
    studentAccountRequiresPayment &&
    (paymentSettings.model !== 'per_course' || (!courseIsFree && !hasCoursePurchase))
  );
  const canAccessCourseContent = !!(
    canPreviewCourse || (canEvaluateStudentAccess && isEnrolled && !coursePaymentRequired)
  );

  const lessonsQuery = useMemoFirebase(() => {
    if (!course || !canAccessCourseContent) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course, canAccessCourseContent]);
  const { data: courseLessons, isLoading: areLessonsLoading } = useCollection<Lesson>(lessonsQuery);

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const isWaitlistPending = enrollmentRequest?.status === 'PENDING';
  const isWaitlistApproved = enrollmentRequest?.status === 'APPROVED';
  const isWaitlistRejected = enrollmentRequest?.status === 'REJECTED';

  useEffect(() => {
    if (enrollment) {
      setCompletedLessons(enrollment.completedLessons || []);
    }
  }, [enrollment]);

  const isLoading =
    isUserLoading ||
    roleLoading ||
    isProfileLoading ||
    isPaymentLoading ||
    isEnrollmentLoading ||
    isPurchaseLoading ||
    isEnrollmentRequestLoading ||
    isCourseLoading ||
    areLessonsLoading;

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
                <Link href={`/login?next=${encodeURIComponent(`/learn/${slug}`)}`} className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block">Go to Login</Link>
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

  const handlePayForCourse = async () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/learn/${slug}`)}`);
      return;
    }
    if (courseIsFree) {
      toast({ title: 'This course is free.' });
      return;
    }
    if (!perCourseCheckoutAvailable) {
      toast({
        variant: 'destructive',
        title: 'Payments are not enabled',
        description: 'Ask an admin to enable Stripe per-course payments in /admin/payment.',
      });
      return;
    }
    try {
      await startCourseCheckout((course as any).id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not start checkout.';
      toast({
        variant: 'destructive',
        title: 'Checkout failed',
        description: message,
      });
    }
  };

  const handleWaitlist = async () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/learn/${slug}`)}`);
      return;
    }

    // Force-refresh token claims before enrollment to avoid stale role mismatches.
    let tokenRoleHint: string | null = null;
    try {
      const tr = await user.getIdTokenResult(true);
      const tokenRole = roleFromClaims(tr.claims);
      tokenRoleHint = tokenRole;
      if (tokenRole !== 'student') {
        toast({
          title: 'Enrollment not available',
          description: 'Only student accounts can enroll in courses.',
        });
        return;
      }
    } catch (e) {
      console.warn('[Enroll] Failed to refresh token claims', e);
    }

    if (!isStudent) {
      toast({
        title: 'Enrollment not available',
        description: 'Only student accounts can enroll in courses.',
      });
      return;
    }
    if (studentAccountRequiresPayment && !canPreviewCourse && paymentSettings.model !== 'per_course') {
      window.location.assign('/#pricing');
      return;
    }

    try {
      setEnrolling(true);

       const courseIsFull = (course as any)?.isFull === true;
       if (!courseIsFull) {
         if (paymentSettings.model === 'per_course' && coursePaymentRequired) {
           await handlePayForCourse();
           return;
         }
         await enrollInCourse(user.uid, course.id);
         try {
           await cancelEnrollmentRequest(user.uid, course.id);
         } catch (e) {
           console.warn('[Enroll] Failed to clear enrollment request', e);
         }
         toast({ title: 'Enrolled', description: 'You can now access the course lessons.' });
         return;
       }

       if (isWaitlistApproved) {
         await enrollInCourse(user.uid, course.id);
         try {
           await cancelEnrollmentRequest(user.uid, course.id);
         } catch (e) {
           console.warn('[Enroll] Failed to clear enrollment request', e);
         }
         if (paymentSettings.model === 'per_course' && coursePaymentRequired) {
           await handlePayForCourse();
           return;
         }
         toast({ title: 'Enrollment started', description: 'You can now access the course lessons.' });
         return;
       }

      await requestEnrollment({
        userId: user.uid,
        courseId: course.id,
        courseTitle: course.title,
        courseCode: (course as any)?.courseCode || null,
      });
      toast({ title: 'Added to waiting list', description: 'We will review your request soon.' });
    } catch (err: any) {
      const code = (err as any)?.code as string | undefined;
      if (code === 'permission-denied') {
        const roleHint = tokenRoleHint || role || 'unknown';
        const profileRoleHint = (userProfile as any)?.role as string | undefined;
        const debug =
          process.env.NODE_ENV !== 'production'
            ? ` (paywall=${paymentSettings.paywall.enabled ? 'on' : 'off'}, defaultRequirePayment=${
                paymentSettings.paywall.defaultRequirePayment ? 'on' : 'off'
              }, requirePayment=${String((userProfile as any)?.requirePayment)}, profile=${
                userProfile ? 'yes' : 'no'
              }, profileRole=${String(profileRoleHint)}, uiRole=${String(roleHint)}
              }, courseIsFull=${String((course as any)?.isFull === true)}, courseId=${String(
                (course as any)?.id || slug,
              )})`
            : '';
        toast({
          variant: 'destructive',
          title: 'Enrollment failed',
          description:
            profileRoleHint && profileRoleHint !== 'student'
              ? `Permission denied. Your profile role is "${profileRoleHint}". Only student accounts can enroll.${debug}`
              :
            roleHint !== 'student'
              ? `Permission denied. Your role is "${roleHint}". Only student accounts can enroll.${debug}`
              : `Permission denied by Firestore rules.${debug}`,
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Enrollment failed',
        description: err?.message || 'Could not update your enrollment.',
      });
    } finally {
      setEnrolling(false);
    }
  };

  if (!canAccessCourseContent) {
    const courseIsFull = (course as any)?.isFull === true;
    const gateTitle =
      isEnrolled && coursePaymentRequired
        ? 'Payment required'
        : courseIsFull
          ? 'Join waiting list'
          : 'Enroll to access this course';
    const gateDescription =
      isEnrolled && coursePaymentRequired
        ? 'You are enrolled, but payment is required to access lessons.'
        : courseIsFull
          ? 'Your request will be reviewed before you can access lessons.'
          : 'You need to enroll before viewing lessons.';
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>{gateTitle}</CardTitle>
                <CardDescription>{gateDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coursePaymentRequired && (
                  <p className="text-sm text-destructive">Payment is required before you can access lessons.</p>
                )}
                {coursePaymentRequired &&
                  paymentSettings.model === 'per_course' &&
                  !perCourseCheckoutAvailable && (
                    <p className="text-sm text-destructive">
                      Payments are disabled or not configured. Ask an admin to enable payments in /admin/payment.
                    </p>
                  )}
                {courseIsFull && isWaitlistPending && (
                  <p className="text-sm text-muted-foreground">
                    Your request is pending approval. You will be able to start once approved.
                  </p>
                )}
                {courseIsFull && isWaitlistRejected && (
                  <p className="text-sm text-destructive">
                    Your request was rejected. You can request again if you think this is a mistake.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {isStudent ? (
                    isEnrolled && paymentSettings.model === 'per_course' && coursePaymentRequired ? (
                      <button
                        disabled={enrolling || !perCourseCheckoutAvailable}
                        onClick={handlePayForCourse}
                        className="px-4 py-2 rounded bg-accent text-accent-foreground disabled:opacity-60"
                      >
                        {perCourseCheckoutAvailable ? `Pay ${(course as any)?.price}` : 'Payments disabled'}
                      </button>
                    ) : (
                      <button
                        disabled={
                          enrolling ||
                          (courseIsFull && isWaitlistPending) ||
                          (!courseIsFull &&
                            paymentSettings.model === 'per_course' &&
                            coursePaymentRequired &&
                            !perCourseCheckoutAvailable)
                        }
                        onClick={handleWaitlist}
                        className="px-4 py-2 rounded bg-accent text-accent-foreground disabled:opacity-60"
                      >
                        {!user
                          ? 'Log in'
                          : !courseIsFull
                              ? enrolling
                                ? 'Enrolling...'
                                : paymentSettings.model === 'per_course' && coursePaymentRequired
                                  ? perCourseCheckoutAvailable
                                    ? 'Pay & Enroll'
                                    : 'Payments disabled'
                                  : studentAccountRequiresPayment &&
                                      !canPreviewCourse &&
                                      paymentSettings.model !== 'per_course'
                                    ? 'View Plans'
                                    : 'Enroll Now'
                            : isWaitlistApproved
                              ? 'Start Course'
                              : isWaitlistPending
                                ? 'On Waiting List'
                                : isWaitlistRejected
                                  ? 'Request Again'
                                  : enrolling
                                    ? 'Saving...'
                                    : 'Join Waiting List'}
                      </button>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">Only students can enroll in courses.</p>
                  )}
                  {studentAccountRequiresPayment && paymentSettings.model !== 'per_course' && (
                    <Link
                      href="/#pricing"
                      className="px-4 py-2 rounded border border-accent text-accent inline-block"
                    >
                      View Plans
                    </Link>
                  )}
                  <Link
                    href={`/courses/${slug}`}
                    className="px-4 py-2 rounded border border-accent text-accent inline-block"
                  >
                    Back to course
                  </Link>
                </div>
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
