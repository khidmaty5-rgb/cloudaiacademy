import { SiteShell } from '@/components/layout/site-shell';

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
