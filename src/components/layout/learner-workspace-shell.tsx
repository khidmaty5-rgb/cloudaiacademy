'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, BookOpen, GraduationCap, LayoutDashboard, UserCog } from 'lucide-react';
import { useLang } from '@/components/i18n/lang';
import { useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { SiteShell } from '@/components/layout/site-shell';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';

const menuItems = [
  { href: '/dashboard', label: { en: 'Dashboard', ar: 'لوحة التحكم' }, icon: LayoutDashboard },
  { href: '/profile', label: { en: 'Profile', ar: 'الملف الشخصي' }, icon: UserCog },
  {
    href: '/learning-path',
    label: { en: 'Learning Path', ar: 'مسار التعلّم' },
    icon: GraduationCap,
  },
  { href: '/courses', label: { en: 'All Courses', ar: 'جميع الدورات' }, icon: BookOpen },
  { href: '/certificates', label: { en: 'Certificates', ar: 'الشهادات' }, icon: Award },
] as const;

export function LearnerWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { role, loading: roleLoading } = useCurrentRole();
  const { lang, dir } = useLang();
  const showStudentMenu =
    !!user && !isUserLoading && !roleLoading && (role === 'student' || role === 'reviewer');

  return (
    <SiteShell dir={dir} headerVariant="app" showFooter={false}>
      <div className="min-h-0 flex-1">
        {showStudentMenu ? (
          <SidebarProvider className="min-h-[calc(100dvh-4rem)]">
            <Sidebar
              side={lang === 'ar' ? 'right' : 'left'}
              variant="inset"
              collapsible="icon"
              className="pt-16"
            >
              <SidebarHeader className="border-b px-3 py-4">
                <div className="flex items-center gap-3 overflow-hidden px-1">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent font-headline text-sm font-bold text-accent-foreground">
                    CA
                  </div>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-semibold">
                      {lang === 'ar' ? 'مساحة التعلّم' : 'Learning workspace'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">CloudAI Academy</p>
                  </div>
                </div>
              </SidebarHeader>
              <SidebarContent className="px-2 py-3">
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        tooltip={item.label[lang]}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label[lang]}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <SidebarInset className="min-h-[calc(100dvh-5rem)] min-w-0 bg-background">
              {children}
            </SidebarInset>
          </SidebarProvider>
        ) : (
          <div className="min-w-0">{children}</div>
        )}
      </div>
    </SiteShell>
  );
}
