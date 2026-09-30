import RouteGuard from '@/components/auth/route-guard';
import { LearnerWorkspaceShell } from '@/components/layout/learner-workspace-shell';

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  return <LearnerWorkspaceShell>{children}</LearnerWorkspaceShell>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <AppLayoutContent>{children}</AppLayoutContent>
    </RouteGuard>
  );
}
