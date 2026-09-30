'use client';

import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/auth/route-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin') return children;
  return <RouteGuard>{children}</RouteGuard>;
}
