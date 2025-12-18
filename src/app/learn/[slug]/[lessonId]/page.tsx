'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getFirestore, collection, query, orderBy } from 'firebase/firestore';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { canTeachCourse } from '@/lib/roles';
import { updateUserProgress, enrollInCourse } from '@/lib/enrollment';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, CheckCircle, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CodeEmbed from '@/components/learn/CodeEmbed';
import Quiz from '@/components/learn/Quiz';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Lesson } from '@/lib/lessons';
import { useLang } from '@/components/i18n/lang';

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const slug = params.slug as string;
  const lessonId = params.lessonId as string;

  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);
  const { isAdmin, isTeacher } = useCurrentRole();

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
        const tr = await u.getIdTokenResult(true);
        const role = (tr.claims as any)?.role;
        setHasAdminOrTeacherClaim(role === 'admin' || role === 'teacher');
      } catch { setHasAdminOrTeacherClaim(false); }
    });
    return () => unsub();
  }, []);

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

  const lessonsQuery = useMemoFirebase(() => {
    if (!course) return null;
    const uid = user?.uid;
    const isInstructor = !!(uid && course && ((course.ownerId === uid) || ((course.instructorIds || []).includes(uid))));
    const canPreviewCourse = !!(isAdmin || (isTeacher && isInstructor));
    const isEnrolled = !!enrollment;
    const canAccessCourseContent = !!(isEnrolled || canPreviewCourse);
    if (!canAccessCourseContent) return null;
    return query(collection(firestore, 'courses', course.id, 'lessons'), orderBy('createdAt', 'asc'));
  }, [firestore, course, user, isAdmin, isTeacher, enrollment]);
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
  const isLessonCompleted = completedLessons.includes(lessonId);
  const [autoEnrolled, setAutoEnrolled] = useState(false);
  const { lang } = useLang();
  const [showWBEmbed, setShowWBEmbed] = useState(false);
  const [showCodingEmbed, setShowCodingEmbed] = useState(false);
  const [showLabEmbed, setShowLabEmbed] = useState(false);
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

  useEffect(() => {
    if (isUserLoading || isEnrollmentLoading || areLessonsLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    const isTeacherOrAdmin = hasAdminOrTeacherClaim === true;
    // Do not auto-enroll admin/teacher per spec
    if (!isTeacherOrAdmin && user && enrollment === null && course && !autoEnrolled) {
      (async () => {
        try {
          await enrollInCourse(user.uid, course.id);
          setAutoEnrolled(true);
        } catch {}
      })();
      return;
    }

    if (user && enrollment && sortedLessons && sortedLessons.length > 0) {
      // Check for sequential access
      const isFirstRun = completedLessons.length === 0;
      const uid2 = user?.uid;
      const isInstructor2 = !!(uid2 && course && ((course.ownerId === uid2) || ((course.instructorIds || []).includes(uid2))));
      const canPreviewCourse = !!(isAdmin || (isTeacher && isInstructor2));
      const isLocked = !isFirstRun && lessonIndex > 0 && !completedLessons.includes(sortedLessons[lessonIndex - 1].id);
      if (isLocked && !canPreviewCourse) {
        toast({
          variant: 'destructive',
          title: 'Lesson Locked',
          description: 'Please complete the previous lesson first.',
        });
      }
    }
  }, [user, isUserLoading, enrollment, isEnrollmentLoading, router, slug, course, sortedLessons, lessonIndex, completedLessons, toast, areLessonsLoading, autoEnrolled, isAdmin]);


  const handleToggleComplete = async () => {
    if (!user || !course || !sortedLessons) return;

    let newCompletedLessons: string[];
    // If the lesson is already completed, we are marking it as incomplete.
    // To maintain sequence, all subsequent lessons must also be marked incomplete.
    if (isLessonCompleted) {
        const lessonStartIndex = sortedLessons.findIndex(l => l.id === lessonId);
        const lessonsToIncomplete = sortedLessons.slice(lessonStartIndex).map(l => l.id);
        newCompletedLessons = completedLessons.filter(id => !lessonsToIncomplete.includes(id));
    } else {
        // Marking as complete, just add it.
        newCompletedLessons = [...new Set([...completedLessons, lessonId])];
    }
      
    const newProgress = Math.round((newCompletedLessons.length / sortedLessons.length) * 100);

    try {
      await updateUserProgress(user.uid, course.id, newProgress, newCompletedLessons);
      toast({
        title: isLessonCompleted ? 'Lesson marked incomplete' : 'Lesson Completed!',
        description: 'Your progress has been saved.'
      });
      // If we just completed the lesson, automatically move to the next one if it exists.
      if (!isLessonCompleted && nextLesson) {
        router.push(`/learn/${slug}/${nextLesson.id}`);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update your progress.',
      });
    }
  };
  
  const uid = user?.uid;
  const isInstructor = !!(uid && canTeachCourse(course as any, uid));
  const canPreviewCourse = !!(isAdmin || (isTeacher && isInstructor));
  const canAccessCourseContent = !!(!!enrollment || canPreviewCourse);
  const isStudent = !canPreviewCourse;
  const isLoading = isUserLoading || isEnrollmentLoading || isCourseLoading || areLessonsLoading;

  if (isLoading || !course || !lesson) {
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


  if (isStudent && enrollment === null) {
      // This can happen briefly while enrollment data is loading or if the user is not enrolled.
      // The main useEffect hook will handle redirection.
      return null;
  }

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
                <div className="flex flex-col md:flex-row gap-3">
                  {lesson.whiteboardUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.whiteboardUrl} target="_blank" rel="noopener noreferrer">
                          {wbLabel}
                        </a>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowWBEmbed((v) => !v)}
                      >
                        {showWBEmbed ? 'Hide Whiteboard' : 'Embed Whiteboard'}
                      </Button>
                    </>
                  )}
                  {lesson.codingUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.codingUrl} target="_blank" rel="noopener noreferrer">
                          {codingLabel}
                        </a>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowCodingEmbed((v) => !v)}
                      >
                        {showCodingEmbed ? 'Hide Coding Lab' : 'Embed Coding Lab'}
                      </Button>
                    </>
                  )}
                  {lesson.labUrl && (
                    <>
                      <Button asChild variant="outline">
                        <a href={lesson.labUrl} target="_blank" rel="noopener noreferrer">
                          {labLabel}
                        </a>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowLabEmbed((v) => !v)}
                      >
                        {showLabEmbed ? 'Hide Cloud Lab' : 'Embed Cloud Lab'}
                      </Button>
                    </>
                  )}
                </div>

                {lesson.whiteboardUrl && showWBEmbed && (
                  <div className="mt-6">
                    <CodeEmbed src={lesson.whiteboardUrl} />
                  </div>
                )}
                {lesson.codingUrl && showCodingEmbed && (
                  <div className="mt-6">
                    <CodeEmbed src={toEmbedUrl(lesson.codingUrl)} />
                  </div>
                )}
                {lesson.labUrl && showLabEmbed && (
                  <div className="mt-6">
                    <CodeEmbed src={lesson.labUrl} />
                  </div>
                )}
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
                {isStudent && (
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
                  isStudent ? (
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
