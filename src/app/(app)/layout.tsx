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
import { Logo } from '@/components/logo';
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
  const showStudentMenu = !!user && !isUserLoading && !roleLoading && role === 'student';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header variant="app" />
      <div className="flex-1">
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarHeader>
                <Logo />
              </SidebarHeader>
              <SidebarMenu>
                {showStudentMenu && (
                  <>
                    {menuItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                        >
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </>
                )}
              </SidebarMenu>
              {/* Admin/Teaching links are no longer duplicated here; they live in the top header dropdown. */}
            </SidebarContent>
          </Sidebar>
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
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
