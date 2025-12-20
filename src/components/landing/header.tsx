'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  LogOut,
  LayoutDashboard,
  UserCog,
  Shield,
  FileText,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Logo } from '@/components/logo';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { signOutUser } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { useLang, LangToggle } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navLinks = [
  { href: '/', id: 'home' as const },
  { href: '/courses', id: 'courses' as const },
  { href: '/journal', id: 'journal' as const },
];

type Role = 'student' | 'teacher' | 'editor' | 'admin' | null;

type UserProfileMenuProps = {
  role: Role;
  canAccessAdmin: boolean;
  isUserLoading: boolean;
  isProfileLoading: boolean;
  showJournalNav: boolean;
  onToggleJournalNav: () => void;
  showStats: boolean;
  onToggleStats: () => void;
  showTestimonials: boolean;
  onToggleTestimonials: () => void;
};

function UserProfileMenu({
  role,
  canAccessAdmin,
  isUserLoading,
  isProfileLoading,
  showJournalNav,
  onToggleJournalNav,
  showStats,
  onToggleStats,
  showTestimonials,
  onToggleTestimonials,
}: UserProfileMenuProps) {
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await signOutUser();
    try {
      if (typeof window !== 'undefined') {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('firebase:')) keys.push(k);
        }
        keys.forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
        try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
      }
    } catch {}
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    } else {
      router.push('/login');
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('');
  };

  if (isUserLoading || isProfileLoading) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-white/20" />;
  }

  if (!user) {
    return (
      <>
        <Button
          asChild
          variant="outline"
          className="hidden sm:inline-flex border-accent text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <Link href="/login">Login</Link>
        </Button>
        <Button
          asChild
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Link href="/signup">Sign Up</Link>
        </Button>
      </>
    );
  }

  const effectiveAdminLabel =
    role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : role === 'editor' ? 'Editor' : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-accent">
            <AvatarImage
              src={user.photoURL ?? undefined}
              alt={user.displayName ?? 'User'}
            />
            <AvatarFallback className="bg-accent text-accent-foreground font-bold">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-accent">
            <AvatarImage
              src={user.photoURL ?? undefined}
              alt={user.displayName ?? 'User'}
            />
            <AvatarFallback className="bg-accent text-accent-foreground font-bold">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {effectiveAdminLabel ?? 'Student'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={role === 'admin' ? '/admin/dashboard' : role === 'editor' ? '/admin/journal' : role === 'teacher' ? '/teacher/dashboard' : '/dashboard'}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        {(role === 'admin' || role === 'editor') && (
          <DropdownMenuItem asChild>
            <Link href="/admin/journal">
              <FileText className="mr-2 h-4 w-4" />
              Journal Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/reviewer">
            <FileText className="mr-2 h-4 w-4" />
            Reviewer Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCog className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {canAccessAdmin && (
          <DropdownMenuItem asChild>
            <Link href={role === 'teacher' ? '/teacher/dashboard' : '/admin/dashboard'}>
              <Shield className="mr-2 h-4 w-4" />
              {effectiveAdminLabel ?? 'Admin'}
            </Link>
          </DropdownMenuItem>
        )}
        {role === 'admin' && (
          <DropdownMenuItem onClick={onToggleJournalNav}>
            {showJournalNav ? 'Hide Journal from Nav' : 'Show Journal in Nav'}
          </DropdownMenuItem>
        )}
        {role === 'admin' && (
          <DropdownMenuItem onClick={onToggleStats}>
            {showStats ? 'Hide Stats on Home' : 'Show Stats on Home'}
          </DropdownMenuItem>
        )}
        {role === 'admin' && (
          <DropdownMenuItem onClick={onToggleTestimonials}>
            {showTestimonials ? 'Hide Testimonials on Home' : 'Show Testimonials on Home'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLang();
  const firestore = getFirestore();
  const { isAdmin, isTeacher, isEditor, loading: roleLoading } = useCurrentRole();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  // Prefer claims for gating; fall back to profile when claims are unavailable
  const effectiveRole: Role = user
    ? (isAdmin ? 'admin' : isEditor ? 'editor' : isTeacher ? 'teacher' : ((userProfile?.role as Role) ?? 'student'))
    : null;
  const canAccessAdmin = effectiveRole === 'admin' || effectiveRole === 'editor' || effectiveRole === 'teacher';
  const isAdminRoute = !!pathname && pathname.startsWith('/admin');

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: uiSettings } = useDoc(settingsDocRef);
  const showJournalNav = uiSettings?.showJournalNav !== false;
  const showStats = uiSettings?.showStats !== false;
  const showTestimonials = uiSettings?.showTestimonials !== false;

  const visibleLinks = showJournalNav ? navLinks : navLinks.filter((l) => l.id !== 'journal');

  const toggleJournalNav = async () => {
    const next = !showJournalNav;
    await setDoc(settingsDocRef as any, { showJournalNav: next }, { merge: true });
  };
  const toggleStats = async () => {
    const next = !showStats;
    await setDoc(settingsDocRef as any, { showStats: next }, { merge: true });
  };
  const toggleTestimonials = async () => {
    const next = !showTestimonials;
    await setDoc(settingsDocRef as any, { showTestimonials: next }, { merge: true });
  };

  const navLabel = (id: 'home' | 'courses' | 'journal') => {
    const map: Record<'en' | 'ar', Record<typeof id, string>> = {
      en: { home: 'Home', courses: 'Courses', journal: 'Journal' },
      ar: { home: 'الرئيسية', courses: 'الدورات', journal: 'المجلة' },
    };
    return map[lang][id];
  };

  const t = (key: 'dashboard' | 'learningPath' | 'admin') => {
    const m = {
      en: {
        dashboard: 'Dashboard',
        learningPath: 'Learning Path',
        admin: 'Admin',
      },
      ar: {
        dashboard: 'لوحة التحكم',
        learningPath: 'مسار التعلّم',
        admin: 'المشرف',
      },
    } as const;
    return m[lang][key];
  };

  const adminNavItems = [
    {
      href: '/admin/dashboard',
      label: lang === 'ar' ? 'لوحة تحكم المشرف' : 'Dashboard',
    },
    {
      href: '/admin/courses',
      label: lang === 'ar' ? 'الدورات' : 'Courses',
    },
    {
      href: '/admin/analytics',
      label: lang === 'ar' ? 'التحليلات' : 'Analytics',
    },
    {
      href: '/admin/journal',
      label: lang === 'ar' ? 'المجلة' : 'Journal',
    },
    {
      href: '/admin/access',
      label: lang === 'ar' ? 'التحكم بالوصول' : 'Access',
    },
    {
      href: '/admin/users',
      label: lang === 'ar' ? 'إدارة المستخدمين' : 'Users',
    },
    {
      href: '/admin/announcements',
      label: lang === 'ar' ? 'الإعلانات' : 'Announcements',
    },
    {
      href: '/admin/seed',
      label: lang === 'ar' ? 'تهيئة البيانات' : 'Seed',
    },
  ] as const;

  const teachingNavItems = [
    { href: '/teacher/dashboard', label: lang === 'ar' ? 'لوحة المعلم' : 'Teaching' },
    { href: '/teacher/courses', label: lang === 'ar' ? 'دوراتي' : 'My Courses' },
  ] as const;

  const filteredAdminNavItems = isTeacher
    ? adminNavItems.filter(
        (i) =>
          i.href !== '/admin/users' &&
          i.href !== '/admin/seed' &&
          i.href !== '/admin/journal' &&
          i.href !== '/admin/access',
      )
    : adminNavItems;

  const handleLogoClick = () => {
    router.push('/');
  };

  // Stable dashboard target to avoid flicker while role claims load
  const preferredDashboardHref =
    effectiveRole === 'admin' ? '/admin/dashboard'
    : effectiveRole === 'editor' ? '/admin/journal'
    : effectiveRole === 'teacher' ? '/teacher/dashboard'
    : '/dashboard';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-sm">
      <div className="container flex h-20 items-center justify-between">
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-3"
        >
          <Logo size={64} textClassName="text-primary-foreground" />
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {/* Always show public nav */}
          {visibleLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`font-medium text-primary-foreground/80 transition-colors hover:text-accent ${
                pathname === link.href ? 'font-semibold text-accent' : ''
              }`}
            >
              {navLabel(link.id)}
            </Link>
          ))}
          {user && (
            <>
              <Link
                href={preferredDashboardHref}
                className="font-medium text-primary-foreground/80 transition-colors hover:text-accent"
              >
                {t('dashboard')}
              </Link>
              {!canAccessAdmin && !roleLoading && (
                <Link
                  href="/learning-path"
                  className="font-medium text-primary-foreground/80 transition-colors hover:text-accent"
                >
                  {t('learningPath')}
                </Link>
              )}
            </>
          )}
          {/* Add Teaching/Admin dropdown */}
          {canAccessAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="font-medium text-primary-foreground/80 hover:text-accent">
                  {isTeacher ? (lang === 'ar' ? 'التدريس' : 'Teaching') : (lang === 'ar' ? 'الإدارة' : 'Admin')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(isTeacher ? teachingNavItems : adminNavItems).map((item) => (
                  <DropdownMenuItem asChild key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle className="hidden md:flex" />
          <ThemeToggle className="hidden md:flex" />
          <UserProfileMenu
            role={effectiveRole}
            canAccessAdmin={canAccessAdmin}
            isUserLoading={isUserLoading}
            isProfileLoading={isProfileLoading}
            showJournalNav={showJournalNav}
            onToggleJournalNav={toggleJournalNav}
            showStats={showStats}
            onToggleStats={toggleStats}
            showTestimonials={showTestimonials}
            onToggleTestimonials={toggleTestimonials}
          />

          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary-foreground/10"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-l-primary-foreground/10 bg-primary text-primary-foreground"
              >
                <SheetHeader>
                  <div className="border-b border-primary-foreground/10 p-4">
                    <Logo size={64} textClassName="text-primary-foreground" />
                  </div>
                  <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                </SheetHeader>
                <nav className="grid gap-4 p-4">
                  <LangToggle className="mb-2" />
                  <ThemeToggle className="mb-2" />
                  {!isAdminRoute && (
                    <>
                      {visibleLinks.map((link) => (
                        <Link
                          key={link.id}
                          href={link.href}
                          onClick={() => setIsOpen(false)}
                          className="text-lg font-medium hover:text-accent"
                        >
                          {navLabel(link.id)}
                        </Link>
                      ))}
                      {user && (
                        <>
                          <Link
                            href={preferredDashboardHref}
                            onClick={() => setIsOpen(false)}
                            className="text-lg font-medium hover:text-accent"
                          >
                            {t('dashboard')}
                          </Link>
                          {!canAccessAdmin && (
                            <Link
                              href="/learning-path"
                              onClick={() => setIsOpen(false)}
                              className="text-lg font-medium hover:text-accent"
                            >
                              {t('learningPath')}
                            </Link>
                          )}
                        </>
                      )}
                      {canAccessAdmin && (
                        <div className="mt-2">
                          <p className="px-2 text-xs text-primary-foreground/60">
                            {isTeacher ? (lang==='ar' ? 'التدريس' : 'Teaching') : (lang==='ar' ? 'الإدارة' : 'Admin')}
                          </p>
                          {(isTeacher ? teachingNavItems : adminNavItems).map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsOpen(false)}
                              className="text-lg font-medium hover:text-accent block"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      )}
                      {!user && (
                        <>
                          <Link
                            href="/login"
                            onClick={() => setIsOpen(false)}
                            className="text-lg font-medium hover:text-accent"
                          >
                            Login
                          </Link>
                          <Link
                            href="/signup"
                            onClick={() => setIsOpen(false)}
                            className="text-lg font-medium hover:text-accent"
                          >
                            Sign Up
                          </Link>
                        </>
                      )}
                      {canAccessAdmin && (
                        <Link
                          href="/admin/dashboard"
                          onClick={() => setIsOpen(false)}
                          className="text-lg font-semibold hover:text-accent"
                        >
                          {t('admin')}
                        </Link>
                      )}
                    </>
                  )}
                  {isAdminRoute && canAccessAdmin && (
                    <>
                      {filteredAdminNavItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className="text-lg font-medium hover:text-accent"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
