'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, QrCode, Settings2, UserRound } from 'lucide-react';
import { doc, getFirestore } from 'firebase/firestore';
import { Logo } from '@/components/logo';
import { useLang } from '@/components/i18n/lang';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { signOutUser } from '@/lib/auth';
import { roleHomePath } from '@/lib/route-access';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const publicLinks = [
  { href: '/', en: 'Home', ar: 'الرئيسية' },
  { href: '/courses', en: 'Courses', ar: 'الدورات' },
  { href: '/research', en: 'Research', ar: 'الأبحاث' },
  { href: '/journal', en: 'Journal', ar: 'المجلة' },
] as const;

// Role-specific destinations belong to WorkspaceShell, not a second public mega-menu.
export default function Header(_props: { variant?: 'public' | 'app' } = {}) {
  const { lang, dir, setLang } = useLang();
  const { user, isUserLoading } = useUser();
  const { role, loading: roleLoading } = useCurrentRole();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const firestore = getFirestore();
  const settingsRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsRef);
  const links = publicLinks.filter(link => link.href !== '/journal' || (!settingsLoading && settings?.showJournalNav !== false));
  const ready = !!user && !isUserLoading && !roleLoading;
  const accountName = user?.displayName?.trim() || (lang === 'ar' ? 'حسابي' : 'My account');
  const tr = (en: string, ar: string) => lang === 'ar' ? ar : en;
  useEffect(() => { setOpen(false); }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace('/login');
    } catch {
      toast({ variant: 'destructive', title: tr('Could not sign out. Please try again.', 'تعذّر تسجيل الخروج. حاول مجددًا.') });
    } finally {
      setSigningOut(false);
    }
  }

  function navigation(mobile = false) {
    return links.map(link => {
      const active = link.href === '/' ? pathname === '/' : pathname === link.href || pathname?.startsWith(link.href + '/');
      return (
        <Link
          key={link.href}
          href={link.href}
          onClick={() => setOpen(false)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mobile ? 'flex min-h-12 items-center px-4' : 'inline-flex h-10 items-center px-4',
            active ? 'bg-accent/15 text-foreground' : 'text-foreground/70 hover:bg-muted hover:text-foreground',
          )}
        >
          {link[lang]}
        </Link>
      );
    });
  }

  return (
    <header dir={dir} className="sticky top-0 z-40 border-b bg-background/95 text-foreground backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={tr('CloudAI Academy home', 'الصفحة الرئيسية لأكاديمية CloudAI')} className="min-w-0 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo size={36} textClassName="text-sm text-foreground sm:text-lg" />
        </Link>
        <nav aria-label={tr('Main navigation', 'القائمة الرئيسية')} className="ms-auto hidden items-center gap-1 xl:flex">
          {navigation()}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2 xl:ms-2">
          <Button variant="ghost" size="sm" className="hidden rounded-xl px-2 sm:inline-flex" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={tr('التبديل إلى العربية', 'Switch to English')}>
            {tr('العربية', 'English')}
          </Button>
          <ThemeToggle className="hidden size-9 rounded-xl text-muted-foreground sm:inline-flex" />
          {isUserLoading || (user && roleLoading) ? (
            <span className="size-9 animate-pulse rounded-full bg-muted" aria-label={tr('Loading account', 'جارٍ تحميل الحساب')} />
          ) : ready ? (
            <>
              <Button asChild className="hidden rounded-xl lg:inline-flex">
                <Link href={roleHomePath(role)}>{tr('My workspace', 'مساحة العمل')}<ArrowUpRight className="ms-2 size-4 rtl:-rotate-90" /></Link>
              </Button>
              <DropdownMenu dir={dir}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9 rounded-full border-accent/30 bg-accent/10" aria-label={tr('Account menu', 'قائمة الحساب')}>
                    {accountName.charAt(0).toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
                  <DropdownMenuLabel className="truncate">{accountName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href={roleHomePath(role)}><LayoutDashboard className="me-2 size-4" />{tr('My workspace', 'مساحة العمل')}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/profile"><UserRound className="me-2 size-4" />{tr('Profile', 'الملف الشخصي')}</Link></DropdownMenuItem>
                  {role === 'admin' && <DropdownMenuItem asChild><Link href="/admin/landing"><Settings2 className="me-2 size-4" />{tr('Website settings', 'إعدادات الموقع')}</Link></DropdownMenuItem>}
                  <DropdownMenuItem asChild><Link href="/print/qr"><QrCode className="me-2 size-4" />{tr('Academy QR code', 'رمز QR للأكاديمية')}</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={signingOut} onSelect={() => void handleSignOut()}><LogOut className="me-2 size-4" />{tr('Sign out', 'تسجيل الخروج')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" className="rounded-xl"><Link href="/login">{tr('Sign in', 'تسجيل الدخول')}</Link></Button>
              <Button asChild className="hidden rounded-xl md:inline-flex"><Link href="/signup">{tr('Get started', 'ابدأ الآن')}</Link></Button>
            </div>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-9 rounded-xl xl:hidden" aria-label={tr('Open navigation', 'فتح القائمة')}><Menu className="size-5" /></Button>
            </SheetTrigger>
            <SheetContent dir={dir} side={dir === 'rtl' ? 'right' : 'left'} closeLabel={tr('Close navigation', 'إغلاق القائمة')} className="flex w-[min(90vw,22rem)] flex-col overflow-y-auto p-5">
              <SheetHeader className="border-b pb-5 pt-4 text-start">
                <SheetTitle>CloudAI Academy</SheetTitle>
                <SheetDescription>{tr('Learn, build, and share knowledge.', 'تعلّم وابتكر وشارك المعرفة.')}</SheetDescription>
              </SheetHeader>
              <nav aria-label={tr('Main navigation', 'القائمة الرئيسية')} className="space-y-1 py-4">{navigation(true)}</nav>
              {ready ? (
                <Button asChild className="min-h-11 rounded-xl"><Link href={roleHomePath(role)} onClick={() => setOpen(false)}>{tr('My workspace', 'مساحة العمل')}<ArrowUpRight className="ms-2 size-4 rtl:-rotate-90" /></Link></Button>
              ) : !isUserLoading && !user ? (
                <div className="grid gap-2">
                  <Button asChild className="min-h-11 rounded-xl"><Link href="/signup" onClick={() => setOpen(false)}>{tr('Get started', 'ابدأ الآن')}</Link></Button>
                  <Button asChild variant="outline" className="min-h-11 rounded-xl"><Link href="/login" onClick={() => setOpen(false)}>{tr('Sign in', 'تسجيل الدخول')}</Link></Button>
                </div>
              ) : null}
              <div className="mt-auto space-y-3 border-t pt-5">
                <Link href="/print/qr" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted"><QrCode className="size-4" />{tr('Academy QR code', 'رمز QR للأكاديمية')}</Link>
                <div className="flex items-center justify-between">
                  <Button variant="outline" className="rounded-xl" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={tr('التبديل إلى العربية', 'Switch to English')}>{tr('العربية', 'English')}</Button>
                  <ThemeToggle className="rounded-xl" />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
