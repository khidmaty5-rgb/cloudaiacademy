import RouteGuard from '@/components/auth/route-guard';
import { SiteShell } from '@/components/layout/site-shell';

export default function DashboardToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <SiteShell showFooter={false}>{children}</SiteShell>
    </RouteGuard>
  );
}
