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

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: UserCog },
  {
    href: '/learning-path',
    label: 'Learning Path',
    icon: GraduationCap,
  },
  { href: '/courses', label: 'All Courses', icon: BookOpen },
  { href: '/certificates', label: 'Certificates', icon: Award },
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { role, loading: roleLoading } = useCurrentRole();
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
                    <p className="truncate text-sm font-semibold">Learning workspace</p>
                    <p className="truncate text-xs text-muted-foreground">CloudAI Academy</p>
                  </div>
                </div>
              </SidebarHeader>
              <SidebarContent className="px-2 py-3">
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
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
      <AppLayoutContent>{children}</AppLayoutContent>
    </FirebaseClientProvider>
  );
}
