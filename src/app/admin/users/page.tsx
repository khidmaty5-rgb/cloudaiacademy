'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc } from 'firebase/firestore';
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
    reviewer: 'مراجع',
    editor: 'محرر',
    admin: 'مشرف',
    selectRolePlaceholder: 'اختر الدور',
    roleUpdatedTitle: 'تم تحديث الدور',
    roleUpdatedDesc: (role: string) =>
      `تم تغيير دور المستخدم إلى ${role}. قد يستغرق تطبيق الصلاحيات لحظات قليلة.`,
    roleUpdateFailedTitle: 'فشل التحديث',
    roleUpdateFailedDesc: 'تعذر تحديث دور المستخدم.',
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

function RoleSelector({ userId, currentRole }: { userId: string, currentRole: string }) {
    const { toast } = useToast();
    const { lang } = useLang();
    const t = usersText[lang];

    const handleRoleChange = async (newRole: 'student' | 'teacher' | 'reviewer' | 'editor' | 'admin') => {
        try {
            await updateUserRole(userId, newRole);
            toast({
                title: t.roleUpdatedTitle,
                description: t.roleUpdatedDesc(
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
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t.roleUpdateFailedTitle,
                description: error.message || t.roleUpdateFailedDesc,
            });
        }
    };

    return (
        <Select defaultValue={currentRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-full shrink-0" aria-label={t.role}>
                <SelectValue placeholder={t.selectRolePlaceholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="student">{t.student}</SelectItem>
                <SelectItem value="teacher">{t.teacher}</SelectItem>
                <SelectItem value="reviewer">{t.reviewer}</SelectItem>
                <SelectItem value="editor">{t.editor}</SelectItem>
                <SelectItem value="admin">{t.admin}</SelectItem>
            </SelectContent>
        </Select>
    );
}

function UserList() {
    const firestore = getFirestore();
    const { lang } = useLang();
    const t = usersText[lang];
    const { isAdmin, loading: roleLoading } = useCurrentRole();

    const usersQuery = useMemoFirebase(() => {
        if (!isAdmin) return null;
        return query(collection(firestore, 'users'), orderBy('dateJoined', 'desc'));
    }, [firestore, isAdmin]);

    const { data: users, isLoading: areUsersLoading } = useCollection(usersQuery);

    const grouped = useMemo(() => {
      const g: Record<'admin' | 'teacher' | 'reviewer' | 'editor' | 'student', any[]> = {
        admin: [],
        teacher: [],
        reviewer: [],
        editor: [],
        student: [],
      };
      for (const u of users || []) {
        const r = (u.role as 'admin' | 'teacher' | 'reviewer' | 'editor' | 'student') || 'student';
        if (g[r]) g[r].push(u);
      }
      return g;
    }, [users]);

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
                  <RoleSelector userId={appUser.id} currentRole={appUser.role} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-6">
        {renderCard('admin', t.admin)}
        {renderCard('teacher', t.teacher)}
        {renderCard('reviewer', t.reviewer)}
        {renderCard('editor', t.editor)}
        {renderCard('student', t.student)}
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
