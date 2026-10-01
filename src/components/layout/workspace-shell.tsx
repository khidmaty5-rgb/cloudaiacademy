'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, Award, BarChart3, BookOpen, ChevronDown, ChevronRight,
  CreditCard, Database, FilePenLine, Globe2, GraduationCap, LayoutDashboard,
  LogOut, Megaphone, Menu, QrCode, Search, Send, Settings2, ShieldCheck, UserRound, Users,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { useLang, type Lang } from '@/components/i18n/lang';
import { useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { signOutUser } from '@/lib/auth';
import { roleHomePath, type AppRole } from '@/lib/route-access';
import { activeWorkspaceLink, navigationForRole, type WorkspaceLink } from '@/lib/workspace-navigation';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const roleLabels: Record<AppRole, { en: string; ar: string }> = {
  admin: { en: 'Administrator', ar: 'مشرف الأكاديمية' },
  editor: { en: 'Editor', ar: 'محرّر' },
  teacher: { en: 'Teacher', ar: 'مدرّس' },
  reviewer: { en: 'Reviewer', ar: 'محكّم' },
  student: { en: 'Learner', ar: 'متعلّم' },
};

function iconForLink(href: string) {
  if (href.includes('dashboard') && !href.includes('telegram')) return LayoutDashboard;
  if (href.includes('course')) return BookOpen;
  if (href.includes('users') || href.includes('waitlist')) return Users;
  if (href.includes('certificate')) return Award;
  if (href.includes('analytics')) return BarChart3;
  if (href.includes('payment')) return CreditCard;
  if (href.includes('landing')) return Settings2;
  if (href.includes('announcements')) return Megaphone;
  if (href.includes('seed')) return Database;
  if (href.includes('access') || href.includes('reviewer')) return ShieldCheck;
  if (href.includes('telegram')) return Send;
  if (href.includes('qr')) return QrCode;
  if (href.includes('profile')) return UserRound;
  if (href.includes('learning-path')) return GraduationCap;
  return FilePenLine;
}

function WorkspaceNavigation({ links, lang, pathname, onNavigate }: {
  links: readonly WorkspaceLink[]; lang: Lang; pathname: string; onNavigate?: () => void;
}) {
  const [query, setQuery] = useState('');
  const active = activeWorkspaceLink(pathname, links);
  const matching = links.filter(link => `${link.label.en} ${link.label.ar} ${link.section.en} ${link.section.ar}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const groups = Array.from(new Set(matching.map(link => link.section.en))).map(key => ({
    key, links: matching.filter(link => link.section.en === key),
  }));

  return <>
    {links.length > 12 && <div className="px-4 pb-4"><div className="relative">
      <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={lang === 'ar' ? 'البحث في القائمة' : 'Search navigation'} placeholder={lang === 'ar' ? 'ابحث عن أداة…' : 'Find a tool…'} className="rounded-xl border-transparent bg-muted/60 ps-9 focus-visible:bg-background" />
    </div></div>}
    <nav aria-label={lang === 'ar' ? 'قائمة مساحة العمل' : 'Workspace navigation'} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-5">
      {groups.map((group, index) => <details key={`${group.key}:${pathname}:${!!query}`} open={!!query || links.length <= 12 || index === 0 || group.key === active?.section.en} className="group/nav-section">
        <summary className="mb-1 flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex-1">{group.links[0].section[lang]}</span><ChevronDown className="size-3.5 transition-transform group-open/nav-section:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-1">{group.links.map(link => {
          const Icon = iconForLink(link.href);
          const selected = active?.href === link.href;
          return <Link key={link.href} href={link.href} onClick={onNavigate} aria-current={selected ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected ? 'bg-accent/15 font-semibold text-foreground ring-1 ring-inset ring-accent/25' : 'text-foreground/70 hover:bg-muted hover:text-foreground')}>
            <Icon className={cn('size-[18px] shrink-0', selected && 'text-orange-600 dark:text-orange-400')} aria-hidden="true" /><span className="min-w-0 flex-1">{link.label[lang]}</span>{selected && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
          </Link>;
        })}</div>
      </details>)}
      {!matching.length && <p className="px-3 py-6 text-sm text-muted-foreground" role="status">{lang === 'ar' ? 'لا توجد نتائج. جرّب كلمة أخرى.' : 'No results. Try another term.'}</p>}
    </nav>
  </>;
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { lang, setLang, dir } = useLang();
  const { user, isUserLoading } = useUser();
  const { role, loading } = useCurrentRole();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ready = !!user && !isUserLoading && !loading;
  const links = useMemo(() => ready ? navigationForRole(role) : [], [ready, role]);
  const current = activeWorkspaceLink(pathname, links);
  const roleLabel = ready ? roleLabels[role][lang] : (lang === 'ar' ? 'مساحة العمل' : 'Workspace');
  const displayName = user?.displayName?.trim() || (lang === 'ar' ? 'حسابي' : 'My account');
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOutUser(); router.replace('/login'); }
    catch { toast({ variant: 'destructive', title: lang === 'ar' ? 'تعذّر تسجيل الخروج. حاول مجددًا.' : 'Could not sign out. Please try again.' }); }
    finally { setSigningOut(false); }
  }

  function sidebar() {
    return <>
      <div className="px-5 pb-5 pt-6">
        <Link href={ready ? roleHomePath(role) : '/'} onClick={() => setMobileOpen(false)} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Logo size={36} textClassName="text-base text-foreground" /></Link>
        <p className="mt-4 text-xs font-medium text-muted-foreground">{roleLabel}</p>
      </div>
      {ready ? <WorkspaceNavigation links={links} lang={lang} pathname={pathname} onNavigate={() => setMobileOpen(false)} /> : <div className="mx-4 h-40 animate-pulse rounded-xl bg-muted" />}
      <div className="mt-auto border-t p-4"><Link href="/" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Globe2 className="size-4" /><span className="flex-1">{lang === 'ar' ? 'زيارة الموقع' : 'View website'}</span><ArrowUpRight className="size-4 rtl:-rotate-90" /></Link></div>
    </>;
  }

  return <div dir={dir} className="workspace-shell flex min-h-dvh min-w-0 bg-background text-foreground">
    <a href="#workspace-content" className="sr-only fixed start-4 top-4 z-[60] rounded-lg bg-card p-3 shadow-lg focus:not-sr-only">{lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e bg-card lg:flex">{sidebar()}</aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur"><div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 rounded-xl lg:hidden" aria-label={lang === 'ar' ? 'فتح القائمة' : 'Open navigation'}><Menu className="size-5" /></Button></SheetTrigger>
          <SheetContent dir={dir} side={dir === 'rtl' ? 'right' : 'left'} closeLabel={lang === 'ar' ? 'إغلاق القائمة' : 'Close navigation'} className="flex w-[min(88vw,20rem)] flex-col gap-0 bg-card p-0 [&>button]:top-2 [&>button]:end-2 [&>button]:start-auto">
            <SheetHeader className="sr-only"><SheetTitle>{lang === 'ar' ? 'قائمة مساحة العمل' : 'Workspace navigation'}</SheetTitle><SheetDescription>{lang === 'ar' ? 'الأدوات المتاحة لحسابك' : 'Tools available to your account'}</SheetDescription></SheetHeader>
            {sidebar()}
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1"><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span>{roleLabel}</span><ChevronRight className="size-3 rtl:rotate-180" /><span>{current?.section[lang] ?? (lang === 'ar' ? 'الأكاديمية' : 'Academy')}</span></div><p className="truncate text-sm font-semibold">{current?.label[lang] ?? (pathname.startsWith('/learn/') ? (lang === 'ar' ? 'مساحة الدرس' : 'Lesson workspace') : 'CloudAI Academy')}</p></div>
        <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="shrink-0 rounded-xl px-2.5" aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>{lang === 'ar' ? 'English' : 'العربية'}</Button>
        <ThemeToggle className="size-9 shrink-0 rounded-xl text-muted-foreground" />
        <DropdownMenu dir={dir}>
          <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-9 shrink-0 rounded-full border-accent/30 bg-accent/10 font-semibold" aria-label={lang === 'ar' ? 'قائمة الحساب' : 'Account menu'}>{displayName.charAt(0).toUpperCase()}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
            <DropdownMenuLabel><p className="truncate">{displayName}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{roleLabel}</p></DropdownMenuLabel><DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile"><UserRound className="size-4" />{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/"><Globe2 className="size-4" />{lang === 'ar' ? 'زيارة الموقع' : 'View website'}</Link></DropdownMenuItem><DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => void handleSignOut()}><LogOut className="size-4" />{lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div></header>
      <div id="workspace-content" tabIndex={-1} className="min-w-0 focus:outline-none">{children}</div>
    </div>
  </div>;
}
