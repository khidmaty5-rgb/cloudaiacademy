'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import RouteGuard from '@/components/auth/route-guard';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isTeacher, isAdmin, loading } = useCurrentRole();
  const { lang } = useLang();

  const showTabs = (
    <nav className="mb-8 flex w-fit flex-wrap gap-1 rounded-xl border bg-card p-1 shadow-sm" aria-label={lang === 'ar' ? 'مساحة التدريس' : 'Teaching workspace'}>
      <Link href="/teacher/dashboard" className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${pathname === '/teacher/dashboard' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{lang === 'ar' ? 'التدريس' : 'Teaching'}</Link>
      <Link href="/teacher/courses" className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${pathname === '/teacher/courses' ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{lang === 'ar' ? 'دوراتي' : 'My Courses'}</Link>
    </nav>
  );

  return (
    <RouteGuard>
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-7xl py-8 md:py-10">
          {showTabs}
          {loading ? (
            <Card className="h-40" />
          ) : (!isTeacher && !isAdmin) ? (
            <div className="text-center py-16 text-muted-foreground">
              {lang === 'ar' ? 'لا تملك صلاحية الوصول.' : 'Access denied.'}
            </div>
          ) : (
            <>
              {isAdmin && !isTeacher && (
                <div className="mb-4 text-sm text-muted-foreground">
                  {lang === 'ar' ? 'أنت تعرض مساحة المدرّس بصلاحية مشرف.' : 'You are viewing the teacher area as an admin.'}
                </div>
              )}
              {children}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
    </RouteGuard>
  );
}
