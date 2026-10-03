"use client";
import { use } from 'react';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { getFirestore, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { SiteShell } from '@/components/layout/site-shell';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { Skeleton } from '@/components/ui/skeleton';
import { useLang } from '@/components/i18n/lang';

type PageProps = {
  params: Promise<{ roomId: string }>;
};


export default function LiveRoomPage({ params }: PageProps) {
  const { roomId: roomParam } = use(params);
  const raw = roomParam || '';
  const roomId = decodeURIComponent(raw);
  const prettyLabel = roomId.replace(/^CloudAIAcademy-/, '') || roomId || 'Live Session';
  const courseId = prettyLabel;
  const jitsiUrl = `https://meet.jit.si/${encodeURIComponent(roomId)}`;

  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const { role, loading: roleLoading, isAdmin, isTeacher } = useCurrentRole();
  const router = useRouter();
  const { lang } = useLang();
  const ar = lang === 'ar';

  const courseDocRef = useMemoFirebase(() => {
    if (!courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course, isLoading: isCourseLoading } = useDoc<any>(courseDocRef);

  const enrollmentDocRef = useMemoFirebase(() => {
    if (!user || !courseId) return null;
    return doc(firestore, 'users', user.uid, 'enrollments', courseId);
  }, [firestore, user, courseId]);
  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc<any>(enrollmentDocRef);

  const isLoading = isUserLoading || roleLoading || isCourseLoading || isEnrollmentLoading;
  if (isLoading) {
    return (
      <SiteShell>
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-28 w-full" />
          </div>
        </main>
      </SiteShell>
    );
  }

  if (!user) {
    const nextHref = `/live/${encodeURIComponent(roomId)}`;
    return (
      <SiteShell>
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle>{ar ? 'تسجيل الدخول مطلوب' : 'Login required'}</CardTitle>
                <CardDescription>{ar ? 'يرجى تسجيل الدخول للانضمام إلى الجلسة المباشرة.' : 'Please login to join this live session.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/login?next=${encodeURIComponent(nextHref)}`}
                  className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block"
                >
                  {ar ? 'الانتقال إلى تسجيل الدخول' : 'Go to Login'}
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </SiteShell>
    );
  }

  const uid = user?.uid;
  const isInstructor = !!(uid && course && ((course.ownerId === uid) || (course.instructorIds || []).includes(uid)));
  const isEnrolled = !!enrollment;
  const canJoinLive = !!(isAdmin || isInstructor || isEnrolled);

  const dashboardHref =
    role === 'admin'
      ? '/admin/dashboard'
      : role === 'teacher'
        ? '/teacher/dashboard'
        : role === 'editor'
          ? '/admin/journal'
          : role === 'reviewer'
            ? '/reviewer'
            : '/dashboard';

  if (!canJoinLive) {
    return (
      <SiteShell>
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle>{ar ? 'الوصول مرفوض' : 'Access denied'}</CardTitle>
                <CardDescription>{ar ? 'يجب أن تكون مسجلاً في الدورة أو مدرساً معيّناً للانضمام إلى هذه الجلسة.' : 'You must be enrolled in this course or an assigned instructor to join this live session.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/courses/${courseId}`} className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block">{ar ? 'الانتقال إلى الدورة' : 'Go to course'}</Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </SiteShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 gap-2">
          <h1 className="text-sm font-medium md:text-base">
            {ar ? 'الفصل المباشر' : 'Live Class'} – <span className="font-semibold">{prettyLabel}</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(jitsiUrl, '_blank', 'noopener,noreferrer')}
              className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground hover:bg-accent/90"
            >
              {ar ? 'الانضمام في تبويب جديد' : 'Join in new tab'}
            </button>
            <button
              onClick={() => router.push(dashboardHref)}
              className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
            >
              {ar ? 'العودة إلى لوحة التحكم' : 'Back to dashboard'}
            </button>
            <span className="hidden md:inline text-xs text-slate-400">Powered by Jitsi (meet.jit.si)</span>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <div className="h-[calc(100vh-3.5rem)] grid place-items-center p-4">
          <Card className="max-w-lg w-full bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>{ar ? 'انضم إلى فصلك المباشر' : 'Join your live class'}</CardTitle>
              <CardDescription>{ar ? 'نفتح Jitsi في تبويب منفصل لتجنب مهلة التضمين.' : 'We open Jitsi in a separate tab to avoid the embed time limit.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.open(jitsiUrl, '_blank', 'noopener,noreferrer')}
                  className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-accent/90"
                >
                  {ar ? 'الانضمام في تبويب جديد' : 'Join in new tab'}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(jitsiUrl)}
                  className="rounded bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
                >
                  {ar ? 'نسخ رابط الدعوة' : 'Copy invite link'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
