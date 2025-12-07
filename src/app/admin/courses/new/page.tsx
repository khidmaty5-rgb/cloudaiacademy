'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import CourseForm from '@/components/admin/CourseForm';
import { useEffect, useState } from 'react';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useLang } from '@/components/i18n/lang';

export default function NewCoursePage() {
  const { user } = useUser();
  const firestore = getFirestore();
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);
  const { lang } = useLang();
  const t = {
    en: {
      pageTitle: 'Add New Course',
      noPermission: 'You do not have permission to view this page.',
    },
    ar: {
      pageTitle: 'إضافة دورة جديدة',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    },
  }[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userDocRef);

  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) { if (!cancelled) setHasAdminOrTeacherClaim(false); return; }
      try {
        const tr = await user.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        const allowed = role === 'admin' || role === 'teacher';
        if (!cancelled) setHasAdminOrTeacherClaim(allowed);
      } catch {
        if (!cancelled) setHasAdminOrTeacherClaim(false);
      }
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
      } catch {
        setHasAdminOrTeacherClaim(false);
      }
    });
    return () => unsub();
  }, []);

  const canView = (userProfile?.role === 'admin' || userProfile?.role === 'teacher' || hasAdminOrTeacherClaim === true);

  if (hasAdminOrTeacherClaim === null) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-2xl mx-auto">
            <Skeleton className="h-8 w-1/2 mb-8" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-2xl mx-auto">
          {canView ? (
            <>
              <h1 className="font-headline text-3xl md:text-4xl font-bold mb-8">
                {t.pageTitle}
              </h1>
              <CourseForm />
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
