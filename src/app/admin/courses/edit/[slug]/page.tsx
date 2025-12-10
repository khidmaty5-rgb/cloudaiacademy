'use client';

import { useParams } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import CourseForm from '@/components/admin/CourseForm';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import LessonManager from '@/components/admin/LessonManager';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';

export default function EditCoursePage() {
  const params = useParams();
  const slug = params.slug as string;
  const firestore = getFirestore();
  const { user } = useUser();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const t = {
    en: {
      pageTitle: 'Edit Course',
      courseNotFound: 'Course not found.',
      noPermission: 'You do not have permission to view this page.',
    },
    ar: {
      pageTitle: 'تعديل الدورة',
      courseNotFound: 'لم يتم العثور على الدورة.',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    },
  }[lang];

  // The course ID is the slug
  const courseDocRef = useMemoFirebase(() => {
    if (!slug) return null;
    return doc(firestore, 'courses', slug);
  }, [firestore, slug]);

  const { data: course, isLoading } = useDoc(courseDocRef);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-4xl mx-auto">
          {roleLoading ? (
            <>
              <Skeleton className="h-8 w-1/2 mb-8" />
              <Skeleton className="h-96 w-full" />
            </>
          ) : isAdmin ? (
            <>
              <h1 className="font-headline text-3xl md:text-4xl font-bold mb-8">
                {t.pageTitle}
              </h1>
              {isLoading ? (
                <Skeleton className="h-96 w-full" />
              ) : course ? (
                <div className="space-y-12">
                  <CourseForm course={course} />
                  <Separator />
                  <LessonManager course={course} />
                </div>
              ) : (
                <p>{t.courseNotFound}</p>
              )}
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
