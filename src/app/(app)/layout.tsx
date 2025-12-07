'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import {
  Shield,
  LayoutDashboard,
  UserCog,
  BookOpen,
  GraduationCap,
  Newspaper,
  BookMarked,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { getAuth, onIdTokenChanged } from 'firebase/auth';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: UserCog },
  {
    href: '/learning-path',
    label: 'Learning Path',
    icon: GraduationCap,
  },
  { href: '/courses', label: 'All Courses', icon: BookOpen },
];

const adminMenuItems = [
  { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/courses', label: 'Courses', icon: BookMarked },
   { href: '/admin/journal', label: 'Journal', icon: Newspaper },
  { href: '/admin/announcements', label: 'Announcements', icon: Newspaper },
  { href: '/admin/users', label: 'Users', icon: Users },
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = getFirestore();
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc(userDocRef);
  // Prefer ID token claims for gating; avoid using Firestore role alone to prevent flicker or stale UI.
  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) { if (!cancelled) setHasAdminOrTeacherClaim(false); return; }
      try {
        const tr = await user.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        const allowed = role === 'admin' || role === 'teacher';
        if (!cancelled) {
          setHasAdminOrTeacherClaim(allowed);
          setRoleLabel(role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : null);
        }
      } catch {
        if (!cancelled) setHasAdminOrTeacherClaim(false);
      }
    }
    checkClaims();
    return () => { cancelled = true };
  }, [user]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) { setHasAdminOrTeacherClaim(false); return; }
      try {
        const tr = await u.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        setHasAdminOrTeacherClaim(role === 'admin' || role === 'teacher');
        setRoleLabel(role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : null);
      } catch {
        setHasAdminOrTeacherClaim(false);
      }
    });
    return () => unsub();
  }, []);

  const canAccessAdmin = hasAdminOrTeacherClaim === true;
  const isTeacher =
    userProfile?.role === 'teacher' || roleLabel === 'Teacher';
  const adminGroupLabel = isTeacher ? 'Teaching' : 'Administration';
  const filteredAdminMenuItems = isTeacher
    ? adminMenuItems.filter(
        (i) => i.href !== '/admin/users' && i.href !== '/admin/journal',
      )
    : adminMenuItems;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex-1">
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarHeader>
                <Logo />
              </SidebarHeader>
              <SidebarMenu>
                {hasAdminOrTeacherClaim === false && (
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
              {canAccessAdmin && (
                <SidebarGroup>
                  <SidebarGroupLabel className="flex items-center gap-2">
                    <Shield />
                    <span>{adminGroupLabel}</span>
                  </SidebarGroupLabel>
                  <SidebarMenu>
                    {filteredAdminMenuItems.map((item) => (
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
                  </SidebarMenu>
                </SidebarGroup>
              )}
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
