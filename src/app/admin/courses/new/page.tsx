'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import CourseForm from '@/components/admin/CourseForm';
import { Skeleton } from '@/components/ui/skeleton';
import { useLang } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export default function NewCoursePage() {
  const { isAdmin, loading: roleLoading } = useCurrentRole();
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
  const canView = isAdmin === true;

  if (roleLoading) {
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
