'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { Switch } from '@/components/ui/switch';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export default function AdminAccessPage() {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();

  const t = {
    en: {
      pageTitle: 'Access Control',
      email: 'Email',
      name: 'Name',
      role: 'Role',
      access: 'Require Payment',
      dateJoined: 'Date Joined',
      createUser: 'Create New User',
      noUsers: 'No users found.',
      noPermission: 'You do not have permission to view this page.',
    },
    ar: {
      pageTitle: 'صلاحيات الوصول',
      email: 'البريد الإلكتروني',
      name: 'الاسم',
      role: 'الدور',
      access: 'يتطلب الدفع',
      dateJoined: 'تاريخ الانضمام',
      createUser: 'إنشاء مستخدم جديد',
      noUsers: 'لا يوجد مستخدمون.',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    },
  }[lang];

  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return query(collection(firestore, 'users'), orderBy('dateJoined', 'desc'));
  }, [firestore, isAdmin]);

  const { data: users, isLoading: areUsersLoading } = useCollection(usersQuery);

  const isLoading = isUserLoading || roleLoading || areUsersLoading;
  const canViewPage = isAdmin === true;

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
                    <TableHead>{t.access}</TableHead>
                    <TableHead>{t.dateJoined}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container text-center">
            <p className="text-muted-foreground">{t.noPermission}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">{t.pageTitle}</h1>
            <Button asChild>
              <Link href="/admin/users/new">{t.createUser}</Link>
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.email}</TableHead>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.role}</TableHead>
                  <TableHead>{t.access}</TableHead>
                  <TableHead>{t.dateJoined}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!users || users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">{t.noUsers}</TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{`${u.firstName} ${u.lastName}`}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>
                        <Switch
                          checked={u.requirePayment === true}
                          disabled={u.role !== 'student'}
                          onCheckedChange={async (checked) => {
                            if (u.role !== 'student') return;
                            try {
                              await updateDoc(doc(firestore, 'users', u.id), { requirePayment: !!checked });
                            } catch {}
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const v: any = u.dateJoined;
                          let d: Date | null = null;
                          if (v) {
                            if (typeof v.toDate === 'function') d = v.toDate();
                            else if (v instanceof Date) d = v;
                            else if (typeof v === 'number') d = new Date(v);
                            else if (typeof v === 'string') { const dd = new Date(v); d = isNaN(dd.getTime()) ? null : dd; }
                          }
                          return d ? d.toLocaleDateString() : 'N/A';
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
