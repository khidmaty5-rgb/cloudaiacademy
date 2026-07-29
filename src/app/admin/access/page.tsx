'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useUser, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { Switch } from '@/components/ui/switch';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { DEFAULT_PAYMENT_SETTINGS, sanitizePaymentSettings } from '@/lib/payment-settings';
import { studentRequiresPayment } from '@/lib/payment-gate';
import { isLearnerRole } from '@/lib/roles';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type CourseLite = {
  title?: string;
  price?: unknown;
  status?: string;
};

type OfflinePaymentMethod = 'cash' | 'local' | 'waived';

function normalizePriceToCents(price: unknown): number | null {
  if (typeof price === 'number' && Number.isFinite(price)) {
    if (price <= 0) return 0;
    return Math.round(price * 100);
  }

  if (typeof price !== 'string') return null;
  const raw = price.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (lowered === 'free' || lowered === '$0' || lowered === '0' || lowered === '0.00') return 0;

  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  return Math.round(n * 100);
}

function CourseOfflinePaymentDialog({
  disabled,
  studentId,
  studentEmail,
  adminId,
  courses,
  currency,
}: {
  disabled: boolean;
  studentId: string;
  studentEmail: string;
  adminId: string;
  courses: Array<CourseLite & { id: string }>;
  currency: string;
}) {
  const firestore = getFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [method, setMethod] = useState<OfflinePaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId) || null,
    [courses, courseId],
  );

  const handleSave = async () => {
    if (!selectedCourse) return;
    const cleanStudentId = (studentId || '').trim();
    const cleanCourseId = (selectedCourse.id || '').trim();
    if (!cleanStudentId || !cleanCourseId) return;

    setSaving(true);
    try {
      const cents = normalizePriceToCents(selectedCourse.price);
      const priceLabel =
        typeof selectedCourse.price === 'string'
          ? selectedCourse.price.trim()
          : typeof selectedCourse.price === 'number'
            ? String(selectedCourse.price)
            : '';

      await setDoc(
        doc(firestore, 'users', cleanStudentId, 'coursePurchases', cleanCourseId),
        {
          courseId: cleanCourseId,
          courseTitle: (selectedCourse.title || cleanCourseId).trim() || cleanCourseId,
          amount: cents ?? undefined,
          currency: (currency || '').toUpperCase() || undefined,
          priceLabel: priceLabel || undefined,
          status: 'PAID',
          paidAt: new Date(),
          confirmedAt: new Date(),
          confirmedBy: 'admin_offline',
          offline: true,
          offlineMethod: method,
          offlineNote: note.trim() || undefined,
          recordedBy: adminId,
          recordedAt: new Date(),
        },
        { merge: true },
      );

      toast({
        title: 'Recorded offline payment',
        description: `${studentEmail} is marked paid for ${selectedCourse.title || cleanCourseId} (${method}).`,
      });
      setOpen(false);
      setCourseId('');
      setMethod('cash');
      setNote('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not record offline payment.';
      toast({ variant: 'destructive', title: 'Save failed', description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || saving || !adminId}>
          Offline payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record offline payment</DialogTitle>
          <DialogDescription>
            Marks a course as paid for this student (cash/local/waived) by creating a purchase record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Course</label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => {
                  const title = (c.title || c.id).trim() || c.id;
                  const status = String(c.status || '').trim().toUpperCase();
                  const price =
                    typeof c.price === 'string'
                      ? c.price.trim()
                      : typeof c.price === 'number'
                        ? String(c.price)
                        : '';
                  const suffixParts = [price || null, status ? `(${status})` : null].filter(Boolean);
                  const suffix = suffixParts.length ? ` - ${suffixParts.join(' ')}` : '';
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {title}
                      {suffix}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Method</label>
            <Select value={method} onValueChange={(v) => setMethod(v as OfflinePaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="local">Local payment</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Receipt #, who collected, etc."
            />
          </div>

          {selectedCourse && normalizePriceToCents(selectedCourse.price) == null && (
            <p className="text-sm text-muted-foreground">
              Note: this course price could not be parsed; the record will still unlock access.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedCourse || disabled || !adminId}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      offlinePayment: 'Offline Payment',
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

  const coursesRef = useMemoFirebase(() => {
    if (!isAdmin) return null;
    return collection(firestore, 'courses');
  }, [firestore, isAdmin]);
  const { data: courses, isLoading: areCoursesLoading } = useCollection(coursesRef);
  const sortedCourses = useMemo(() => {
    const arr = (Array.isArray(courses) ? [...courses] : []) as Array<CourseLite & { id: string }>;
    arr.sort((a, b) => {
      return String(a?.title || a?.id || '').localeCompare(String(b?.title || b?.id || ''), undefined, {
        sensitivity: 'base',
      });
    });
    return arr;
  }, [courses]);

  const paymentDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'payment'), [firestore]);
  const { data: paymentDoc, isLoading: isPaymentLoading } = useDoc<any>(paymentDocRef);
  const paymentSettings = useMemo(
    () => sanitizePaymentSettings(paymentDoc, DEFAULT_PAYMENT_SETTINGS),
    [paymentDoc],
  );

  const isLoading = isUserLoading || roleLoading || areUsersLoading || isPaymentLoading || areCoursesLoading;
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
                    <TableHead>{(t as any).offlinePayment || 'Offline Payment'}</TableHead>
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
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
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
          {!paymentSettings.paywall.enabled && (
            <div className="mb-6 rounded-lg border border-accent/30 bg-accent/10 p-4 text-sm text-muted-foreground">
              Paywall is disabled. Enable it in <Link className="underline" href="/admin/payment">Payment Settings</Link> to enforce payment access.
            </div>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.email}</TableHead>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.role}</TableHead>
                  <TableHead>{t.access}</TableHead>
                  <TableHead>{(t as any).offlinePayment || 'Offline Payment'}</TableHead>
                  <TableHead>{t.dateJoined}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!users || users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {t.noUsers}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{`${u.firstName} ${u.lastName}`}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>
                      <Switch
                          checked={studentRequiresPayment(paymentSettings, u as any)}
                          disabled={!isLearnerRole(u.role) || !paymentSettings.paywall.enabled}
                          onCheckedChange={async (checked) => {
                            if (!isLearnerRole(u.role) || !paymentSettings.paywall.enabled) return;
                            try {
                              await updateDoc(doc(firestore, 'users', u.id), { requirePayment: !!checked });
                            } catch {}
                          }}
                        />
                    </TableCell>
                    <TableCell>
                      <CourseOfflinePaymentDialog
                        disabled={
                          !isLearnerRole(u.role) ||
                          paymentSettings.model !== 'per_course' ||
                          sortedCourses.length === 0
                        }
                        studentId={u.id}
                        studentEmail={String(u.email || u.id)}
                        adminId={user?.uid || ''}
                        courses={sortedCourses}
                        currency={paymentSettings.currency}
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
