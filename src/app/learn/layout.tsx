import RouteGuard from '@/components/auth/route-guard';
import { SiteShell } from '@/components/layout/site-shell';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <SiteShell headerVariant="app" showFooter={false}>
        {children}
      </SiteShell>
    </RouteGuard>
  );
}
