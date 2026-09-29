import RouteGuard from '@/components/auth/route-guard';

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
