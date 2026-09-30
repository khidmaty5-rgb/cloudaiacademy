import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';

type SiteShellProps = {
  children: React.ReactNode;
  dir?: 'ltr' | 'rtl';
  headerVariant?: 'public' | 'app';
  showFooter?: boolean;
};

export function SiteShell({
  children,
  dir,
  headerVariant = 'public',
  showFooter = true,
}: SiteShellProps) {
  return (
    <div dir={dir} className="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background">
      <Header variant={headerVariant} />
      <div className="min-w-0 flex-1">{children}</div>
      {showFooter && <Footer />}
    </div>
  );
}

export function PageContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
