'use client';

import { SiteShell, PageContainer } from '@/components/layout/site-shell';
import { Card } from '@/components/ui/card';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import RouteGuard from '@/components/auth/route-guard';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { isTeacher, isAdmin, loading } = useCurrentRole();
  const { lang } = useLang();

  return (
    <RouteGuard>
    <SiteShell showFooter={false}>
      <main className="flex-1">
        <PageContainer className="py-8 md:py-10">
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
        </PageContainer>
      </main>
    </SiteShell>
    </RouteGuard>
  );
}
