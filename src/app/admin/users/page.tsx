'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { USER_ROLES, isUserRole, type UserRole } from '@/lib/user-roles';
import { useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc, documentId, limit, startAfter } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, BookOpen, GraduationCap, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateUserRole } from '@/lib/user';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
 

const usersText = {
  en: {
    pageTitle: 'Manage Users',
    createUser: 'Create New User',
    email: 'Email',
    name: 'Name',
    role: 'Role',
    noUsers: 'No users in this role.',
    unavailable: 'Not available',
    dateJoined: 'Date Joined',
    access: 'Access',
    requirePayment: 'Require Payment',
    noPermission: 'You do not have permission to view this page.',
    student: 'Student',
    teacher: 'Teacher',
    reviewer: 'Reviewer',
    editor: 'Editor',
    admin: 'Admin',
    selectRolePlaceholder: 'Select role',
    roleUpdatedTitle: 'Role Updated',
    roleUpdatedDesc: (role: string) =>
      `User role has been changed to ${role}. It may take a few moments for permissions to update.`,
    roleUpdateFailedTitle: 'Update Failed',
    roleUpdateFailedDesc: 'Could not update user role.',
    claimsPending: 'The role is saved. Token synchronization is pending; current profile permissions already apply.',
  },
  ar: {
    pageTitle: 'إدارة المستخدمين',
    createUser: 'إنشاء مستخدم جديد',
    email: 'البريد الإلكتروني',
    name: 'الاسم',
    role: 'الدور',
    noUsers: 'لا يوجد مستخدمون بهذا الدور.',
    unavailable: 'غير متوفر',
    dateJoined: 'تاريخ الانضمام',
    access: 'الصلاحية',
    requirePayment: 'يتطلب الدفع',
    noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    student: 'طالب',
    teacher: 'معلم',
    reviewer: 'محكّم',
    editor: 'محرر',
    admin: 'مشرف',
    selectRolePlaceholder: 'اختر الدور',
    roleUpdatedTitle: 'تم تحديث الدور',
    roleUpdatedDesc: (role: string) =>
      `تم تغيير دور المستخدم إلى ${role}. قد يستغرق تطبيق الصلاحيات لحظات قليلة.`,
    roleUpdateFailedTitle: 'فشل التحديث',
    roleUpdateFailedDesc: 'تعذر تحديث دور المستخدم.',
    claimsPending: 'تم حفظ الدور. تحديث رمز الدخول قيد الانتظار؛ صلاحيات الملف الحالية مطبّقة بالفعل.',
  },
} as const;

function toDateValue(v: any): Date | null {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function RoleSelector({ userId, currentRole, identity }: { userId: string, currentRole: string, identity: string }) {
    const { toast } = useToast();
    const { lang } = useLang();
    const t = usersText[lang];
    const { user } = useUser();
    const [proposedRole, setProposedRole] = useState<UserRole | null>(null);
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const self = user?.uid === userId;
    const summaries: Record<UserRole, { en: string; ar: string }> = {
      student: { en: 'Learning, certificates and article submissions.', ar: 'التعلّم والشهادات وإرسال المقالات.' },
      teacher: { en: 'Assigned course teaching, lesson management and Telegram.', ar: 'تدريس الدورات المخصصة وإدارة الدروس وتيليجرام.' },
      reviewer: { en: 'Assigned peer reviews plus learner tools.', ar: 'تحكيم الأبحاث المخصصة وأدوات التعلّم.' },
      editor: { en: 'Editorial decisions and peer-review management.', ar: 'القرارات التحريرية وإدارة التحكيم العلمي.' },
      admin: { en: 'Academy-wide administration, people, payments and settings.', ar: 'إدارة الأكاديمية والمستخدمين والمدفوعات والإعدادات.' },
    };

    const handleRoleChange = async (newRole: UserRole) => {
        if (inFlight.current || self || newRole === currentRole) return;
        inFlight.current = true;
        setBusy(true);
        try {
            const result = await updateUserRole(userId, newRole);
            toast({
                title: t.roleUpdatedTitle,
                description: result.claimsSyncPending ? t.claimsPending : t.roleUpdatedDesc(
                  newRole === 'student'
                    ? t.student
                    : newRole === 'teacher'
                      ? t.teacher
                      : newRole === 'reviewer'
                        ? t.reviewer
                        : newRole === 'editor'
                          ? t.editor
                          : t.admin,
                ),
            });
            setProposedRole(null);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t.roleUpdateFailedTitle,
                description: error.message || t.roleUpdateFailedDesc,
            });
        } finally { inFlight.current = false; setBusy(false); }
    };

    return (
        <>
        <Select value={currentRole} disabled={self || busy} onValueChange={value => { if (isUserRole(value) && value !== currentRole) setProposedRole(value); }}>
            <SelectTrigger className="w-full shrink-0" aria-label={t.role}>
                <SelectValue placeholder={t.selectRolePlaceholder} />
            </SelectTrigger>
            <SelectContent>
                {USER_ROLES.map(role => <SelectItem key={role} value={role}>{t[role]}</SelectItem>)}
            </SelectContent>
        </Select>
        {self && <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'لا يمكنك تغيير دور حسابك. يجب أن يتولى ذلك مشرف آخر.' : 'You cannot change your own role. Another administrator must do this.'}</p>}
        <AlertDialog open={!!proposedRole} onOpenChange={open => { if (!open && !inFlight.current) setProposedRole(null); }}>
          <AlertDialogContent dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>
              <AlertDialogTitle>{lang === 'ar' ? 'تأكيد تغيير الدور' : 'Confirm role change'}</AlertDialogTitle>
              <AlertDialogDescription>
                <span dir="auto" className="block break-all font-medium">{identity}</span>
                <span className="mt-2 block">{isUserRole(currentRole) ? t[currentRole] : currentRole} → {proposedRole && t[proposedRole]}</span>
                <span className="mt-2 block">{proposedRole && summaries[proposedRole][lang]}</span>
                <span className="mt-2 block">{lang === 'ar' ? 'يسجّل الخادم هذا التغيير ويتحقق من الصلاحيات. لا يمكن إزالة آخر مشرف.' : 'This change is audited and validated by the server. The last administrator cannot be removed.'}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={busy}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
              <Button disabled={busy} onClick={() => { if (proposedRole) void handleRoleChange(proposedRole); }}>{busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : (lang === 'ar' ? 'تأكيد التغيير' : 'Confirm change')}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

function UserList() {
    const firestore = getFirestore();
    const { lang } = useLang();
    const t = usersText[lang];
    const { isAdmin, loading: roleLoading } = useCurrentRole();
    const [cursors, setCursors] = useState<{ dateJoined: unknown; id: string }[]>([]);
    const [search, setSearch] = useState('');
    const cursor = cursors[cursors.length - 1];

    const usersQuery = useMemoFirebase(() => {
        if (!isAdmin) return null;
        return query(collection(firestore, 'users'), orderBy('dateJoined', 'desc'), orderBy(documentId(), 'desc'),
          ...(cursor ? [startAfter(cursor.dateJoined, cursor.id)] : []), limit(51));
    }, [firestore, isAdmin, cursor]);

    const { data: users, isLoading: areUsersLoading, error: usersError } = useCollection(usersQuery);
    const pageUsers = useMemo(() => (users || []).slice(0, 50), [users]);

    const grouped = useMemo(() => {
      const g: Record<'admin' | 'teacher' | 'reviewer' | 'editor' | 'student', any[]> = {
        admin: [],
        teacher: [],
        reviewer: [],
        editor: [],
        student: [],
      };
      for (const u of pageUsers) {
        if (search.trim() && !`${u.email || ''} ${u.firstName || ''} ${u.lastName || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) continue;
        const r = (u.role as 'admin' | 'teacher' | 'reviewer' | 'editor' | 'student') || 'student';
        if (g[r]) g[r].push(u);
      }
      return g;
    }, [pageUsers, search]);

    if (usersError) return <div role="alert" className="space-y-3 rounded-xl border p-6">
      <p>{lang === 'ar' ? 'تعذّر تحميل المستخدمين. تحقق من اتصالك وصلاحياتك.' : 'People could not be loaded. Check your connection and permissions.'}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>
    </div>;

    if (areUsersLoading || roleLoading) {
      return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex flex-wrap items-center justify-between gap-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const roleStyles: Record<'admin' | 'teacher' | 'reviewer' | 'editor' | 'student', {
      border: string;
      bg: string;
      Icon: (props: any) => JSX.Element;
      iconColor: string;
      title: string;
    }> = {
      admin: { border: 'border-red-500', bg: 'bg-red-500/10', Icon: Shield as any, iconColor: 'text-red-500', title: t.admin },
      teacher: { border: 'border-blue-500', bg: 'bg-blue-500/10', Icon: BookOpen as any, iconColor: 'text-blue-500', title: t.teacher },
      reviewer: { border: 'border-amber-500', bg: 'bg-amber-500/10', Icon: FileText as any, iconColor: 'text-amber-600', title: t.reviewer },
      editor: { border: 'border-purple-500', bg: 'bg-purple-500/10', Icon: Shield as any, iconColor: 'text-purple-500', title: t.editor },
      student: { border: 'border-green-500', bg: 'bg-green-500/10', Icon: GraduationCap as any, iconColor: 'text-green-500', title: t.student },
    };

    const renderCard = (role: 'admin' | 'teacher' | 'reviewer' | 'editor' | 'student', title: string) => {
      const S = roleStyles[role];
      const Icon = S.Icon;
      return (
        <Card className="min-w-0 rounded-xl border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Icon className={`h-5 w-5 ${S.iconColor}`} />
              <span>{title}</span>
              <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">{grouped[role].length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {grouped[role].length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noUsers}</p>
            ) : (
              grouped[role].map((appUser) => (
                <div key={appUser.id} className="min-w-0 space-y-3 border-t pt-4">
                  <div className="min-w-0 space-y-1">
                    <p dir="auto" className="break-all text-sm font-medium">{appUser.email}</p>
                    <p dir="auto" className="break-words text-sm text-muted-foreground">{`${appUser.firstName} ${appUser.lastName}`}</p>
                    <p className="text-xs text-muted-foreground">{(() => { const d = toDateValue(appUser.dateJoined); return d ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(d) : t.unavailable; })()}</p>
                  </div>
                  <RoleSelector userId={appUser.id} currentRole={appUser.role} identity={appUser.email || appUser.id} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-md space-y-2">
          <label htmlFor="people-page-search" className="text-sm font-medium">{lang === 'ar' ? 'البحث في هذه الصفحة' : 'Search this page'}</label>
          <Input id="people-page-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={lang === 'ar' ? 'الاسم أو البريد الإلكتروني' : 'Name or email'} />
          <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'يُحمّل حتى ٥٠ مستخدمًا في كل صفحة. الأعداد والبحث لهذه الصفحة فقط.' : 'Up to 50 people per page. Counts and search apply to this page only.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={!cursors.length} onClick={() => { setSearch(''); setCursors(previous => previous.slice(0, -1)); }}>{lang === 'ar' ? 'السابق' : 'Previous'}</Button>
          <span className="text-sm" aria-live="polite">{lang === 'ar' ? 'الصفحة' : 'Page'} {cursors.length + 1}</span>
          <Button variant="outline" disabled={!users || users.length <= 50} onClick={() => { const last = pageUsers[pageUsers.length - 1]; if (last) { setSearch(''); setCursors(previous => [...previous, { dateJoined: last.dateJoined, id: last.id }]); } }}>{lang === 'ar' ? 'التالي' : 'Next'}</Button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-6">
        {renderCard('admin', t.admin)}
        {renderCard('teacher', t.teacher)}
        {renderCard('reviewer', t.reviewer)}
        {renderCard('editor', t.editor)}
        {renderCard('student', t.student)}
      </div>
      </div>
    );
}


export default function AdminUsersPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const t = usersText[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading || roleLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, roleLoading, router]);

  const isLoading = isUserLoading || isProfileLoading || roleLoading;
  const canViewPage = isAdmin === true;

  if (isLoading) {
     return (
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
          <main className="flex-1 py-10 md:py-16">
            <div className="container">
               <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-36" />
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-28" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="flex flex-wrap items-center justify-between gap-3">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-8 w-28" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </main>
        </div>
     )
  }

  // Render the page only if the user profile has been confirmed to be an admin
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
      <main className="flex-1 py-6 md:py-8">
        <div className="container">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">
              {t.pageTitle}
            </h1>
            {canViewPage && (
                 <Button asChild>
                    <Link href="/admin/users/new">{t.createUser}</Link>
                </Button>
            )}
          </div>
          
          {canViewPage ? (
            <UserList />
          ) : (
             <div className="text-center py-16">
                <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
