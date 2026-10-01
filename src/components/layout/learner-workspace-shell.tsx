'use client';

import { SiteShell } from '@/components/layout/site-shell';

// Course browsing and protected learner pages share the role-aware workspace.
export function LearnerWorkspaceShell({ children }: { children: React.ReactNode }) {
  return <SiteShell headerVariant="app" showFooter={false}>{children}</SiteShell>;
}
