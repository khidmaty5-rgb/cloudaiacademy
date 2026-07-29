'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getFirestore, collection, query, orderBy } from 'firebase/firestore';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { canTeachCourse, isLearnerRole, roleFromClaims } from '@/lib/roles';
import { updateUserProgress, enrollInCourse } from '@/lib/enrollment';
import { cancelEnrollmentRequest, requestEnrollment } from '@/lib/enrollment-requests';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, CheckCircle, BrainCircuit, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CodeEmbed from '@/components/learn/CodeEmbed';
import Quiz from '@/components/learn/Quiz';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Lesson } from '@/lib/lessons';
import { useLang } from '@/components/i18n/lang';
import ToolSandbox from '@/components/learn/tool-sandbox';
import LessonPdfSandbox from '@/components/learn/lesson-pdf-sandbox';
import type { EnrollmentRequest, UserProfile } from '@/types/models';
import { DEFAULT_PAYMENT_SETTINGS, sanitizePaymentSettings } from '@/lib/payment-settings';
import { studentRequiresPayment } from '@/lib/payment-gate';
import { confirmCoursePurchase, startCourseCheckout } from '@/lib/course-checkout';
import { isPriceFree } from '@/lib/course-price';

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const slug = params.slug as string;
  const lessonId = params.lessonId as string;

  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const { role, loading: roleLoading, isAdmin, isTeacher } = useCurrentRole();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const paymentDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'payment'), [firestore]);
  const { data: paymentDoc, isLoading: isPaymentLoading } = useDoc(paymentDocRef);
  const paymentSettings = useMemo(
    () => sanitizePaymentSettings(paymentDoc, DEFAULT_PAYMENT_SETTINGS),
    [paymentDoc],
  );
  const perCoursePaymentAvailable =
    paymentSettings.enabled &&
    paymentSettings.model === 'per_course' &&
    (paymentSettings.provider === 'stripe' || paymentSettings.provider === 'paypal');

  const courseDocRef = useMemoFirebase(() => {
    if (!slug) return null;
    return doc(firestore, 'courses', slug);
  }, [firestore, slug]);
  const { data: course, isLoading: isCourseLoading } = useDoc(courseDocRef);

  // lessons list for navigation/sequencing; gated below after enrollment check
  // We'll initialize after we know if the user can access content


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
  const isWaitlistPending = enrollmentRequest?.status === 'PENDING';
  const isWaitlistApproved = enrollmentRequest?.status === 'APPROVED';
  const isWaitlistRejected = enrollmentRequest?.status === 'REJECTED';
  const [isWaitlistSaving, setIsWaitlistSaving] = useState(false);

  const uid = user?.uid;
  const isInstructor = !!(uid && canTeachCourse(course as any, uid));
  const canPreviewCourse = !!(isAdmin || (isTeacher && isInstructor));
  const isLearner = !!user && !roleLoading && isLearnerRole(role);
  const studentAccountRequiresPayment =
    isLearner && studentRequiresPayment(paymentSettings, userProfile);
  const courseIsFree = !!(course && isPriceFree((course as any)?.price));
  const coursePaymentRequired = !!(
    isLearner &&
    !canPreviewCourse &&
    paymentSettings.paywall.enabled &&
    studentAccountRequiresPayment &&
    (paymentSettings.model !== 'per_course' || (!courseIsFree && !hasCoursePurchase))
  );
  const canEvaluateStudentAccess =
    !roleLoading && !isProfileLoading && !isPaymentLoading && !isEnrollmentLoading && !isPurchaseLoading;
  const canAccessCourseContent = !!(
    canPreviewCourse || (canEvaluateStudentAccess && isEnrolled && !coursePaymentRequired)
  );

  const lessonsQuery = useMemoFirebase(() => {
    if (!course || !canAccessCourseContent) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course, canAccessCourseContent]);
  const { data: courseLessons, isLoading: areLessonsLoading } = useCollection<Lesson>(lessonsQuery);

  const sortedLessons = useMemo(() => {
    if (!courseLessons) return null;
    // Prefer explicit 'order' if present; otherwise preserve incoming order
    const withOrder = [...courseLessons];
    withOrder.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return 0;
    });
    return withOrder;
  }, [courseLessons]);

  const lesson = useMemo(() => sortedLessons?.find((l) => l.id === lessonId), [sortedLessons, lessonId]);
  const lessonIndex = useMemo(() => sortedLessons?.findIndex((l) => l.id === lessonId) ?? -1, [sortedLessons, lessonId]);
  
  const prevLesson = lessonIndex > 0 ? sortedLessons?.[lessonIndex - 1] : null;
  const nextLesson = (sortedLessons && lessonIndex < sortedLessons.length - 1) ? sortedLessons[lessonIndex + 1] : null;

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const completedLessonSet = useMemo(() => {
    const set = new Set<string>();
    const fromEnrollment = (enrollment as any)?.completedLessons as string[] | undefined;
    if (Array.isArray(fromEnrollment)) {
      for (const id of fromEnrollment) set.add(id);
    }
    for (const id of completedLessons) set.add(id);
    return set;
  }, [completedLessons, enrollment]);

  const isLessonCompleted = completedLessonSet.has(lessonId);
  const { lang } = useLang();
  const toEmbedUrl = (url: string) => {
    try {
      const u = new URL(url);
      const h = u.hostname;
      if (h.includes('stackblitz.com')) {
        if (!u.searchParams.has('embed')) u.searchParams.set('embed', '1');
        return u.toString();
      }
      if (h.includes('replit.com')) {
        u.searchParams.set('embed', '1');
        return u.toString();
      }
      if (h.includes('codesandbox.io')) {
        u.pathname = u.pathname.replace('/s/', '/embed/').replace('/p/', '/embed/');
        return u.toString();
      }
      if (h.includes('livecodes.io')) {
        // LiveCodes supports embedding; ensure embed mode param for best UX.
        if (!u.searchParams.has('embed')) u.searchParams.set('embed', '1');
        return u.toString();
      }
      return url;
    } catch {
      return url;
    }
  };

  useEffect(() => {
    if (enrollment) {
      setCompletedLessons(enrollment.completedLessons || []);
    }
  }, [enrollment]);


  const handleToggleComplete = async () => {
    if (!user || !course || !sortedLessons) return;

    const currentCompleted = Array.from(completedLessonSet);
    let newCompletedLessons: string[];
    // If the lesson is already completed, we are marking it as incomplete.
    // To maintain sequence, all subsequent lessons must also be marked incomplete.
    if (isLessonCompleted) {
        const lessonStartIndex = sortedLessons.findIndex(l => l.id === lessonId);
        const lessonsToIncomplete = sortedLessons.slice(lessonStartIndex).map(l => l.id);
        newCompletedLessons = currentCompleted.filter(id => !lessonsToIncomplete.includes(id));
    } else {
        // Marking as complete, just add it.
        newCompletedLessons = [...new Set([...currentCompleted, lessonId])];
    }
      
    const newProgress = Math.round((newCompletedLessons.length / sortedLessons.length) * 100);

    try {
      await updateUserProgress(user.uid, course.id, newProgress, newCompletedLessons);
      setCompletedLessons(newCompletedLessons);
      toast({
        title: isLessonCompleted ? 'Lesson marked incomplete' : 'Lesson Completed!',
        description: 'Your progress has been saved.'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your progress.',
      });
    }
  };
  
  const isLoading =
    isUserLoading ||
    roleLoading ||
    isCourseLoading ||
    isProfileLoading ||
    isPaymentLoading ||
    isEnrollmentLoading ||
    isPurchaseLoading ||
    isEnrollmentRequestLoading ||
    areLessonsLoading;

  const handlePayForCourse = async () => {
    if (!course) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/learn/${slug}/${lessonId}`)}`);
      return;
    }
    if (courseIsFree) {
      toast({ title: 'This course is free.' });
      return;
    }
    if (!perCoursePaymentAvailable) {
      toast({
        variant: 'destructive',
        title: 'Payments are not enabled',
        description: 'Ask an admin to enable payments (and select Stripe/PayPal) in /admin/payment.',
      });
      return;
    }
    try {
      // Avoid double-charging: try to confirm an existing successful payment first.
      if (paymentSettings.provider === 'stripe') {
        try {
          await confirmCoursePurchase((course as any).id);
          toast({ title: 'Payment confirmed', description: 'Access unlocked.' });
          router.refresh();
          return;
        } catch {}
      }
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
      router.push(`/login?next=${encodeURIComponent(`/learn/${slug}/${lessonId}`)}`);
      return;
    }

    // Force-refresh token claims before enrollment to avoid stale role mismatches.
    let tokenRoleHint: string | null = null;
    try {
      const tr = await user.getIdTokenResult(true);
      const tokenRole = roleFromClaims(tr.claims);
      tokenRoleHint = tokenRole;
      if (!isLearnerRole(tokenRole)) {
        toast({
          title: 'Enrollment not available',
          description: 'Only learner accounts (student or reviewer) can enroll in courses.',
        });
        return;
      }
    } catch (e) {
      console.warn('[Enroll] Failed to refresh token claims', e);
    }

    if (!isLearner) {
      toast({
        title: 'Enrollment not available',
        description: 'Only learner accounts (student or reviewer) can enroll in courses.',
      });
      return;
    }
    if (studentAccountRequiresPayment && !canPreviewCourse && paymentSettings.model !== 'per_course') {
      window.location.assign('/#pricing');
      return;
    }

    try {
      setIsWaitlistSaving(true);

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
        router.push(`/learn/${slug}`);
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
        router.push(`/learn/${slug}`);
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
          title: 'Request failed',
          description:
            profileRoleHint && !isLearnerRole(profileRoleHint)
              ? `Permission denied. Your profile role is "${profileRoleHint}". Only learner accounts can enroll.${debug}`
              :
            !isLearnerRole(roleHint)
              ? `Permission denied. Your role is "${roleHint}". Only learner accounts can enroll.${debug}`
              : `Permission denied by Firestore rules.${debug}`,
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Request failed',
        description: err?.message || 'Could not update your request.',
      });
    } finally {
      setIsWaitlistSaving(false);
    }
  };

  if (isLoading) {
     return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-10 w-3/4 mb-8" />
            <Skeleton className="h-40 w-full" />
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
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-muted-foreground">Course not found.</p>
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
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>Login required</CardTitle>
                <CardDescription>Please login to view this lesson.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/login?next=${encodeURIComponent(`/learn/${slug}/${lessonId}`)}`}>Go to Login</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
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
                  !perCoursePaymentAvailable && (
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
                  {isLearner ? (
                    isEnrolled && paymentSettings.model === 'per_course' && coursePaymentRequired ? (
                      <Button
                        disabled={isWaitlistSaving || !perCoursePaymentAvailable}
                        onClick={handlePayForCourse}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-60"
                      >
                        {perCoursePaymentAvailable ? `Pay ${(course as any)?.price}` : 'Payments disabled'}
                      </Button>
                    ) : (
                      <Button
                        disabled={
                          isWaitlistSaving ||
                          (courseIsFull && isWaitlistPending) ||
                          (!courseIsFull &&
                            paymentSettings.model === 'per_course' &&
                            coursePaymentRequired &&
                            !perCoursePaymentAvailable)
                        }
                        onClick={handleWaitlist}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground disabled:opacity-60"
                      >
                        {!courseIsFull
                            ? isWaitlistSaving
                              ? 'Enrolling...'
                              : paymentSettings.model === 'per_course' && coursePaymentRequired
                              ? perCoursePaymentAvailable
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
                                : isWaitlistSaving
                                  ? 'Saving...'
                                  : 'Join Waiting List'}
                      </Button>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Only learner accounts (student or reviewer) can enroll in courses.
                    </p>
                  )}
                  {studentAccountRequiresPayment && paymentSettings.model !== 'per_course' && (
                    <Button asChild variant="outline">
                      <Link href="/#pricing">View Plans</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href={`/courses/${slug}`}>Back to course</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>Lesson not found</CardTitle>
                <CardDescription>This lesson does not exist in this course.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/learn/${slug}`}>Back to course</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isLessonLocked = !!(prevLesson && !completedLessonSet.has(prevLesson.id) && !canPreviewCourse);
  if (isLessonLocked) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-destructive" />
                  Lesson Locked
                </CardTitle>
                <CardDescription>Please complete the previous lesson first.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {prevLesson ? (
                  <Button asChild variant="outline">
                    <Link href={`/learn/${slug}/${prevLesson.id}`}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Go to previous lesson
                    </Link>
                  </Button>
                ) : null}
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href={`/learn/${slug}`}>Back to course</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  
  const displayTitle = lang === 'ar' && lesson.title_ar ? lesson.title_ar : lesson.title;
  const displayContent = lang === 'ar' && lesson.content_ar ? lesson.content_ar : lesson.content;
  const hasInteractiveTools = !!(lesson.whiteboardUrl || lesson.codingUrl || lesson.labUrl);
  const wbLabel = (() => {
    const p = (lesson as any).whiteboardPlatform as
      | 'excalidraw'
      | 'miro'
      | 'ms-whiteboard'
      | undefined;
    if (p === 'excalidraw') return 'Open Excalidraw';
    if (p === 'miro') return 'Open Miro';
    if (p === 'ms-whiteboard') return 'Open Microsoft Whiteboard';
    return 'Open Whiteboard';
  })();
  const codingLabel = (() => {
    const p = (lesson as any).codingPlatform as
      | 'replit'
      | 'codesandbox'
      | 'stackblitz'
      | 'colab'
      | 'livecodes'
      | undefined;
    if (p === 'replit') return 'Open Replit';
    if (p === 'codesandbox') return 'Open CodeSandbox';
    if (p === 'stackblitz') return 'Open StackBlitz';
    if (p === 'colab') return 'Open Colab';
    if (p === 'livecodes') return 'Open LiveCodes';
    return 'Open Coding Lab';
  })();
  const labLabel = (() => {
    const p = (lesson as any).labPlatform as
      | 'labex'
      | 'whizlabs'
      | 'vmware-hol'
      | 'virtual-labs'
      | undefined;
    if (p === 'labex') return 'Open LabEx';
    if (p === 'whizlabs') return 'Open Whizlabs';
    if (p === 'vmware-hol') return 'Open VMware Hands-on Labs';
    if (p === 'virtual-labs') return 'Open Virtual Labs';
    return 'Open Cloud Lab';
  })();
  const openInAppLabel = lang === 'ar' ? 'فتح داخل التطبيق' : 'Open in app';


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-4xl mx-auto">
          <Link href={`/learn/${slug}`} className="text-sm text-accent hover:underline mb-4 inline-block">
            &larr; Back to {course.title}
          </Link>
          
          <Card className="border-accent">
            <CardHeader>
              <CardTitle className='font-headline text-3xl'>{displayTitle}</CardTitle>
              {sortedLessons && <CardDescription>{lang==='ar' ? 'الدرس' : 'Lesson'} {lessonIndex + 1} {lang==='ar' ? 'من' : 'of'} {sortedLessons.length}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className="prose prose-lg max-w-none text-foreground whitespace-pre-wrap font-body mb-8" dir={lang==='ar' ? 'rtl' : 'ltr'}>
                    <p>{displayContent}</p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  If you see a blocked icon, the provider may disallow embedding. Use the Open button instead.
                </p>
                {lesson.embedUrl && <CodeEmbed src={lesson.embedUrl} />}
                {lesson.pdfPath ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <LessonPdfSandbox courseId={course.id} lessonId={lesson.id} title={displayTitle} />
                  </div>
                ) : null}
            </CardContent>
          </Card>

          {hasInteractiveTools && (
            <Card className="mt-8 border-accent">
              <CardHeader>
                <CardTitle>Interactive Tools</CardTitle>
                <CardDescription>
                  Use these tools for live collaboration, coding practice, or hands-on labs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-3 flex-wrap">
                  {lesson.whiteboardUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.whiteboardUrl} target="_blank" rel="noopener noreferrer">
                          {wbLabel}
                        </a>
                      </Button>
                      <ToolSandbox
                        title={wbLabel}
                        triggerLabel={openInAppLabel}
                        iframeSrc={lesson.whiteboardUrl}
                        openHref={lesson.whiteboardUrl}
                      />
                    </>
                  )}
                  {lesson.codingUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.codingUrl} target="_blank" rel="noopener noreferrer">
                          {codingLabel}
                        </a>
                      </Button>
                      <ToolSandbox
                        title={codingLabel}
                        triggerLabel={openInAppLabel}
                        iframeSrc={toEmbedUrl(lesson.codingUrl)}
                        openHref={lesson.codingUrl}
                      />
                    </>
                  )}
                  {lesson.labUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.labUrl} target="_blank" rel="noopener noreferrer">
                          {labLabel}
                        </a>
                      </Button>
                      <ToolSandbox
                        title={labLabel}
                        triggerLabel={openInAppLabel}
                        iframeSrc={lesson.labUrl}
                        openHref={lesson.labUrl}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

           <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              {prevLesson ? (
                <Button variant="outline" asChild>
                  <Link href={`/learn/${slug}/${prevLesson.id}`}>
                    <ArrowLeft className="mr-2" /> Previous Lesson
                  </Link>
                </Button>
              ) : <div className='w-40'/>}
            </div>
            
            <div className="flex gap-2">
                {isLearner && (
                  <>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <BrainCircuit className="mr-2" /> Take Quiz
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Quiz: {displayTitle}</DialogTitle>
                        </DialogHeader>
                        <Quiz lessonContent={displayContent} />
                      </DialogContent>
                    </Dialog>
                    <Button
                      onClick={handleToggleComplete}
                      className={`min-w-[200px] ${isLessonCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-accent hover:bg-accent/90'} text-accent-foreground`}
                    >
                      {isLessonCompleted ? (
                        <>
                          <CheckCircle className="mr-2" /> Mark as Incomplete
                        </>
                      ) : (
                        'Complete Lesson'
                      )}
                    </Button>
                  </>
                )}
            </div>
            
            <div>
                {nextLesson ? (
                  isLearner ? (
                    !isLessonCompleted ? (
                      <Button variant="outline" disabled>
                        Next Lesson <ArrowRight className="ml-2" />
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <Link href={`/learn/${slug}/${nextLesson.id}`}>
                          Next Lesson <ArrowRight className="ml-2" />
                        </Link>
                      </Button>
                    )
                  ) : (
                    <Button variant="outline" asChild>
                      <Link href={`/learn/${slug}/${nextLesson.id}`}>
                        Next Lesson <ArrowRight className="ml-2" />
                      </Link>
                    </Button>
                  )
                ) : <div className='w-40' />}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
