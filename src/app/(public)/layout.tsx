'use client';
import { useLang } from '@/components/i18n/lang';
import { SiteShell } from '@/components/layout/site-shell';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dir } = useLang();
  // SiteShell owns the session decision; keep its identity stable while auth loads.
  return <SiteShell dir={dir}>{children}</SiteShell>;
}
