'use client';
import { useLang } from '@/components/i18n/lang';
import { SiteShell } from '@/components/layout/site-shell';
import { LearnerWorkspaceShell } from '@/components/layout/learner-workspace-shell';
import { useUser } from '@/firebase';
import { usePathname } from 'next/navigation';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dir } = useLang();
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const useLearnerWorkspace =
    !isUserLoading && !!user && !!pathname && pathname.startsWith('/courses');

  if (useLearnerWorkspace) {
    return <LearnerWorkspaceShell>{children}</LearnerWorkspaceShell>;
  }

  return <SiteShell dir={dir}>{children}</SiteShell>;
}
