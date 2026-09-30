'use client';
import { useLang } from '@/components/i18n/lang';
import { SiteShell } from '@/components/layout/site-shell';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  function LangRoot({ children }: { children: React.ReactNode }) {
    const { dir } = useLang();
    return <SiteShell dir={dir}>{children}</SiteShell>;
  }
  return <LangRoot>{children}</LangRoot>;
}
