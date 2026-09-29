import RouteGuard from '@/components/auth/route-guard';

export default function DashboardToolsLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
