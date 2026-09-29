'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
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
import { LayoutDashboard, UserCog, BookOpen, GraduationCap, Award } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useLang } from '@/components/i18n/lang';
import RouteGuard from '@/components/auth/route-guard';

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
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { role, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const showStudentMenu =
    !!user && !isUserLoading && !roleLoading && (role === 'student' || role === 'reviewer');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header variant="app" />
      <div className="flex-1">
        {showStudentMenu ? (
          <SidebarProvider>
            <Sidebar variant="inset" collapsible="icon" className="pt-16">
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
            <SidebarInset className="min-w-0 bg-background">{children}</SidebarInset>
          </SidebarProvider>
        ) : (
          <div className="min-w-0">{children}</div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <RouteGuard>
        <AppLayoutContent>{children}</AppLayoutContent>
      </RouteGuard>
    </FirebaseClientProvider>
  );
}
