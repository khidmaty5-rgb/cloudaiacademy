'use client';

import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/auth/route-guard';
import { SiteShell } from '@/components/layout/site-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const content = pathname === '/admin' ? children : <RouteGuard>{children}</RouteGuard>;

  return (
    <SiteShell headerVariant="app" showFooter={false}>
      {content}
    </SiteShell>
  );
}
