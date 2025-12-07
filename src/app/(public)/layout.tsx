'use client';
import { useLang } from '@/components/i18n/lang';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  function LangRoot({ children }: { children: React.ReactNode }) {
    const { dir } = useLang();
    return <div dir={dir}>{children}</div>;
  }
  return <LangRoot>{children}</LangRoot>;
}
