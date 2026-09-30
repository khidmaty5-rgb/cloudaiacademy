'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import {
  allowedRolesForPath,
  roleHomePath,
  type AppRole,
} from '@/lib/route-access';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { role, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const allowed = allowedRolesForPath(pathname);
  const authorized = !!user && (allowed === null || allowed.includes(role as AppRole));
  const loading = isUserLoading || (!!user && roleLoading);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!authorized) router.replace(roleHomePath(role as AppRole));
  }, [authorized, loading, pathname, role, router, user]);

  if (loading || !authorized) {
    return (
      <div className="grid min-h-[45vh] place-items-center px-4" role="status" aria-live="polite">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          <span>
            {lang === 'ar'
              ? authorized ? 'جارٍ تحميل مساحة العمل…' : 'جارٍ توجيهك إلى المساحة المناسبة…'
              : authorized ? 'Loading your workspace…' : 'Taking you to the right workspace…'}
          </span>
        </div>
      </div>
    );
  }

  return children;
}
