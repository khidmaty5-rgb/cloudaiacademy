'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useLang } from '@/components/i18n/lang';

type SiteShellProps = {
  children: React.ReactNode;
  dir?: 'ltr' | 'rtl';
  headerVariant?: 'public' | 'app';
  showFooter?: boolean;
};

export function SiteShell({
  children,
  dir,
  headerVariant = 'public',
  showFooter = true,
}: SiteShellProps) {
  const { user, isUserLoading } = useUser();
  const { lang } = useLang();
  const pathname = usePathname() ?? '';
  const workspacePage = pathname !== '/' && pathname !== '/admin' &&
    !pathname.startsWith('/verify/') && !pathname.startsWith('/print/');
  // Resolve the session before choosing a shell, so the public header never
  // flashes above a signed-in workspace during a direct page load.
  if (isUserLoading && workspacePage) return (
    <div dir={dir} className="flex min-h-dvh items-center justify-center bg-background p-6" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'جارٍ تحميل مساحة العمل…' : 'Loading your workspace…'}</p>
    </div>
  );
  if (user && workspacePage) return <WorkspaceShell>{children}</WorkspaceShell>;

  return (
    <div dir={dir} className="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background">
      <Header variant={headerVariant} />
      <div className="min-w-0 flex-1">{children}</div>
      {showFooter && <Footer />}
    </div>
  );
}

export function PageContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
