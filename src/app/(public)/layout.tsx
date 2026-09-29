'use client';
import { useLang } from '@/components/i18n/lang';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  function LangRoot({ children }: { children: React.ReactNode }) {
    const { dir } = useLang();
    return (
      <div dir={dir} className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    );
  }
  return <LangRoot>{children}</LangRoot>;
}
