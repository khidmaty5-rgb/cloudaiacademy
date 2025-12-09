'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useLang } from '@/components/i18n/lang';
import { Switch } from '@/components/ui/switch';

const usersText = {
  en: {
    pageTitle: 'Manage Users',
    createUser: 'Create New User',
    email: 'Email',
    name: 'Name',
    role: 'Role',
    dateJoined: 'Date Joined',
    access: 'Access',
    requirePayment: 'Require Payment',
    noPermission: 'You do not have permission to view this page.',
    student: 'Student',
    teacher: 'Teacher',
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
    dateJoined: 'تاريخ الانضمام',
    access: 'الصلاحية',
    requirePayment: 'يتطلب الدفع',
    noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    student: 'طالب',
    teacher: 'معلم',
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

    const handleRoleChange = async (newRole: 'student' | 'teacher' | 'admin') => {
        try {
            await updateUserRole(userId, newRole);
            toast({
                title: t.roleUpdatedTitle,
                description: t.roleUpdatedDesc(
                  newRole === 'student' ? t.student : newRole === 'teacher' ? t.teacher : t.admin,
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
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t.selectRolePlaceholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="student">{t.student}</SelectItem>
                <SelectItem value="teacher">{t.teacher}</SelectItem>
                <SelectItem value="admin">{t.admin}</SelectItem>
            </SelectContent>
        </Select>
    );
}

function UserList() {
    const firestore = getFirestore();
    const { user } = useUser();
    const [canListUsers, setCanListUsers] = useState(false);
    const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);

    // Only allow the users list subscription when the ID token has the admin claim.
    useEffect(() => {
        let cancelled = false;
        async function checkClaims() {
            if (!user) { setCanListUsers(false); return; }
            try {
                const tr = await user.getIdTokenResult();
                const isAdmin = (tr.claims as any)?.role === 'admin';
                if (!cancelled) {
                  setCanListUsers(!!isAdmin);
                  setHasAdminClaim(!!isAdmin);
                }
            } catch {
                if (!cancelled) {
                  setCanListUsers(false);
                  setHasAdminClaim(false);
                }
            }
        }
        checkClaims();
        return () => { cancelled = true };
    }, [user]);

    useEffect(() => {
        const auth = getAuth();
        const unsub = onIdTokenChanged(auth, async (u) => {
            if (!u) { setCanListUsers(false); setHasAdminClaim(false); return; }
            try {
                const tr = await u.getIdTokenResult(true);
                const isAdmin = (tr.claims as any)?.role === 'admin';
                setCanListUsers(!!isAdmin);
                setHasAdminClaim(!!isAdmin);
            } catch {
                setCanListUsers(false);
                setHasAdminClaim(false);
            }
        });
        return () => unsub();
    }, []);

    const usersQuery = useMemoFirebase(() => {
        if (!canListUsers) return null;
        return query(collection(firestore, 'users'), orderBy('dateJoined', 'desc'));
    }, [firestore, canListUsers]);

    const { data: users, isLoading: areUsersLoading } = useCollection(usersQuery);

    if (areUsersLoading) {
        return (
            Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </TableRow>
            ))
        )
    }

    if (!users || users.length === 0) {
        return (
            <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                    No users found.
                </TableCell>
            </TableRow>
        );
    }

    return (
        <>
            {users.map((appUser) => (
                <TableRow key={appUser.id}>
                  <TableCell className="font-medium">{appUser.email}</TableCell>
                  <TableCell>{`${appUser.firstName} ${appUser.lastName}`}</TableCell>
                  <TableCell>
                    <RoleSelector userId={appUser.id} currentRole={appUser.role} />
                  </TableCell>
                  <TableCell>
                    {(() => { const d = toDateValue(appUser.dateJoined); return d ? format(d, 'PPP') : 'N/A'; })()}
                  </TableCell>
                </TableRow>
            ))}
        </>
    );
}


export default function AdminUsersPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);
  const { lang } = useLang();
  const t = usersText[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) {
        if (!cancelled) setHasAdminClaim(null);
        return;
      }
      try {
        const tr = await user.getIdTokenResult();
        const isAdmin = (tr.claims as any)?.role === 'admin';
        if (!cancelled) setHasAdminClaim(isAdmin);
      } catch {
        if (!cancelled) setHasAdminClaim(false);
      }
    }
    checkClaims();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (isUserLoading || isProfileLoading || hasAdminClaim === null) return; // wait until claim check completes
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, hasAdminClaim, router]);

  const isLoading = isUserLoading || isProfileLoading || hasAdminClaim === null;
  const canViewPage = userProfile?.role === 'admin' || hasAdminClaim === true;

  if (isLoading) {
     return (
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1 py-10 md:py-16">
            <div className="container">
               <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-36" />
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.email}</TableHead>
                      <TableHead>{t.name}</TableHead>
                      <TableHead>{t.role}</TableHead>
                      <TableHead>{t.dateJoined}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-48" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-28" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </main>
          <Footer />
        </div>
     )
  }

  // Render the page only if the user profile has been confirmed to be an admin
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
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
            <div className="border rounded-lg">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>{t.email}</TableHead>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.role}</TableHead>
                    <TableHead>{t.dateJoined}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <UserList />
                </TableBody>
                </Table>
            </div>
          ) : (
             <div className="text-center py-16">
                <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </div>
  );
}
