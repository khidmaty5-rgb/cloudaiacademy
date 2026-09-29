import RouteGuard from '@/components/auth/route-guard';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
