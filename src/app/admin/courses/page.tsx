'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, getFirestore, query, orderBy, doc } from 'firebase/firestore';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Pencil } from 'lucide-react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useLang } from '@/components/i18n/lang';

const coursesText = {
  en: {
    pageTitle: 'Manage Courses',
    resetAndSeed: 'Reset & Seed',
    resetting: 'Resetting...',
    seedSampleData: 'Seed Sample Data',
    seeding: 'Seeding...',
    addNewCourse: 'Add New Course',
    image: 'Image',
    title: 'Title',
    category: 'Category',
    price: 'Price',
    level: 'Level',
    actions: 'Actions',
    noCourses: 'No courses found.',
    noPermission: 'You do not have permission to view this page.',
    toastSeedFailedTitle: 'Seed failed',
    toastSeedErrorTitle: 'Seed error',
    toastSeedCompleteTitle: 'Seeding complete',
    toastResetFailedTitle: 'Reset failed',
    toastResetErrorTitle: 'Reset error',
    toastResetCompleteTitle: 'Reset complete',
    unknownError: 'Unknown error',
  },
  ar: {
    pageTitle: 'إدارة الدورات',
    resetAndSeed: 'إعادة التهيئة مع التكوين',
    resetting: 'جارٍ إعادة التهيئة...',
    seedSampleData: 'توليد بيانات تجريبية',
    seeding: 'جارٍ التوليد...',
    addNewCourse: 'إضافة دورة جديدة',
    image: 'الصورة',
    title: 'العنوان',
    category: 'التصنيف',
    price: 'السعر',
    level: 'المستوى',
    actions: 'الإجراءات',
    noCourses: 'لا توجد دورات.',
    noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    toastSeedFailedTitle: 'فشل التهيئة',
    toastSeedErrorTitle: 'خطأ في التهيئة',
    toastSeedCompleteTitle: 'اكتملت التهيئة',
    toastResetFailedTitle: 'فشل إعادة التهيئة',
    toastResetErrorTitle: 'خطأ في إعادة التهيئة',
    toastResetCompleteTitle: 'اكتملت إعادة التهيئة',
    unknownError: 'خطأ غير معروف',
  },
} as const;

export default function AdminCoursesPage() {
  const firestore = getFirestore();
  const { user } = useUser();
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { lang } = useLang();
  const t = coursesText[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userDocRef);

  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) {
        if (!cancelled) setHasAdminOrTeacherClaim(false);
        return;
      }
      try {
        const tr = await user.getIdTokenResult();
        const role = (tr.claims as any)?.role;
        const allowed = role === 'admin' || role === 'teacher';
        if (!cancelled) setHasAdminOrTeacherClaim(allowed);
      } catch {
        if (!cancelled) setHasAdminOrTeacherClaim(false);
      }
    }
    checkClaims();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setHasAdminOrTeacherClaim(false);
        return;
      }
      try {
        const tr = await u.getIdTokenResult(true);
        const role = (tr.claims as any)?.role;
        setHasAdminOrTeacherClaim(role === 'admin' || role === 'teacher');
      } catch {
        setHasAdminOrTeacherClaim(false);
      }
    });
    return () => unsub();
  }, []);

  const coursesQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'courses'), orderBy('title'));
  }, [firestore]);

  const { data: courses, isLoading } = useCollection(coursesQuery);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const u = getAuth().currentUser;
      const token = await u?.getIdToken(true);
      const resp = await fetch('/api/admin/seed-courses', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await resp.json();
      if (!resp.ok) {
        toast({
          variant: 'destructive',
          title: t.toastSeedFailedTitle,
          description: j?.error || t.unknownError,
        });
      } else {
        toast({
          title: t.toastSeedCompleteTitle,
          description:
            lang === 'ar'
              ? `تم إنشاء ${j?.seeded ?? 0} دورة.`
              : `Seeded ${j?.seeded ?? 0} courses.`,
        });
        router.refresh();
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t.toastSeedErrorTitle,
        description: e?.message || t.unknownError,
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      const u = getAuth().currentUser;
      const token = await u?.getIdToken(true);
      const resp = await fetch('/api/admin/reset-courses', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await resp.json();
      if (!resp.ok) {
        toast({
          variant: 'destructive',
          title: t.toastResetFailedTitle,
          description: j?.error || t.unknownError,
        });
      } else {
        toast({
          title: t.toastResetCompleteTitle,
          description:
            lang === 'ar'
              ? `تم حذف الدورات: ${j?.deletedCourses ?? 0}، التسجيلات: ${j?.deletedEnrollments ?? 0}. أُعيدت تهيئة: ${j?.seeded ?? 0}.`
              : `Deleted courses: ${j?.deletedCourses ?? 0}, enrollments: ${j?.deletedEnrollments ?? 0}. Reseeded: ${j?.seeded ?? 0}.`,
        });
        router.refresh();
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t.toastResetErrorTitle,
        description: e?.message || t.unknownError,
      });
    } finally {
      setResetting(false);
    }
  };

  const canView =
    userProfile?.role === 'admin' ||
    userProfile?.role === 'teacher' ||
    hasAdminOrTeacherClaim === true;

  if (hasAdminOrTeacherClaim === null) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container">
            <Skeleton className="h-8 w-1/3 mb-8" />
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">{t.image}</TableHead>
                    <TableHead>{t.title}</TableHead>
                    <TableHead>{t.category}</TableHead>
                    <TableHead>{t.price}</TableHead>
                    <TableHead>{t.level}</TableHead>
                    <TableHead>{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-12 w-12 rounded-md" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-8" />
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
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container">
          {canView ? (
            <>
              <div className="flex justify-between items-center mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                  {t.pageTitle}
                </h1>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting ? t.resetting : t.resetAndSeed}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSeed}
                    disabled={seeding}
                  >
                    {seeding ? t.seeding : t.seedSampleData}
                  </Button>
                  <Button asChild>
                    <Link href="/admin/courses/new">{t.addNewCourse}</Link>
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">{t.image}</TableHead>
                      <TableHead>{t.title}</TableHead>
                      <TableHead>{t.category}</TableHead>
                      <TableHead>{t.price}</TableHead>
                      <TableHead>{t.level}</TableHead>
                      <TableHead>{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-12 w-12 rounded-md" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : courses && courses.length > 0 ? (
                      courses.map((course) => {
                        const image = PlaceHolderImages.find(
                          (img) => img.id === course.imageId,
                        );
                        return (
                          <TableRow key={course.id}>
                            <TableCell>
                              <div className="relative h-12 w-12">
                                {image && (
                                  <Image
                                    src={image.imageUrl}
                                    alt={course.title}
                                    fill
                                    className="rounded-md object-cover"
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {course.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {course.category}
                              </Badge>
                            </TableCell>
                            <TableCell>{course.price}</TableCell>
                            <TableCell>{course.level}</TableCell>
                            <TableCell>
                              <Button asChild variant="ghost" size="icon">
                                <Link
                                  href={`/admin/courses/edit/${course.slug}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          {t.noCourses}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
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

