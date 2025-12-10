"use client";
import { use } from 'react';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { getFirestore, doc } from 'firebase/firestore';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/useCurrentRole';

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

  const { user } = useUser();
  const firestore = getFirestore();
  const { isAdmin } = useCurrentRole();

  const courseDocRef = useMemoFirebase(() => {
    if (!courseId) return null;
    return doc(firestore, 'courses', courseId);
  }, [firestore, courseId]);
  const { data: course } = useDoc<any>(courseDocRef);

  const enrollmentDocRef = useMemoFirebase(() => {
    if (!user || !courseId) return null;
    return doc(firestore, 'users', user.uid, 'enrollments', courseId);
  }, [firestore, user, courseId]);
  const { data: enrollment } = useDoc<any>(enrollmentDocRef);

  const uid = user?.uid;
  const isInstructor = !!(uid && course && ((course.ownerId === uid) || (course.instructorIds || []).includes(uid)));
  const isEnrolled = !!enrollment;
  const canJoinLive = !!(isAdmin || isInstructor || isEnrolled);

  if (!canJoinLive) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle>Access denied</CardTitle>
                <CardDescription>You must be enrolled in this course or an assigned instructor to join this live session.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/courses/${courseId}`} className="px-4 py-2 rounded bg-accent text-accent-foreground inline-block">Go to course</Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <h1 className="text-sm font-medium md:text-base">
            Live Class – <span className="font-semibold">{prettyLabel}</span>
          </h1>
          <span className="text-xs text-slate-400">Powered by Jitsi (meet.jit.si)</span>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <div className="h-[calc(100vh-3.5rem)]">
          <iframe
            src={jitsiUrl}
            className="h-full w-full border-0"
            allow="camera; microphone; fullscreen; display-capture"
            title={`Live: ${prettyLabel}`}
          />
        </div>
      </main>
    </div>
  );
}
