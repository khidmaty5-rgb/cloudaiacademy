'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { useState } from 'react';
import { useLang } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export default function AdminSeedPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { lang } = useLang();
  const t = {
    en: {
      pageTitle: 'Seed Courses',
      checkingPermissions: 'Checking permissions...',
      description:
        'This will upsert a set of example courses and lessons into Firestore.',
      runSeed: 'Run Seed',
      seeding: 'Seeding...',
      notSignedIn: 'Not signed in',
      seedFailed: 'Seed failed',
      seedError: 'Seed error',
      seedComplete: 'Seeding complete',
      noPermission: 'You do not have permission to run this action.',
      unknownError: 'Unknown error',
    },
    ar: {
      pageTitle: 'تهيئة الدورات',
      checkingPermissions: 'جارٍ التحقق من الصلاحيات...',
      description:
        'ستقوم هذه العملية بإضافة مجموعة من الدورات والدروس التجريبية إلى Firestore أو تحديثها.',
      runSeed: 'تشغيل التهيئة',
      seeding: 'جارٍ التهيئة...',
      notSignedIn: 'غير مسجل الدخول',
      seedFailed: 'فشلت عملية التهيئة',
      seedError: 'خطأ في عملية التهيئة',
      seedComplete: 'اكتملت عملية التهيئة',
      noPermission: 'ليس لديك صلاحية لتنفيذ هذه العملية.',
      unknownError: 'خطأ غير معروف',
    },
  }[lang];

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc(userDocRef);

  const canRun = isAdmin === true;

  const runSeed = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: t.notSignedIn });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const token = await user.getIdToken(true);
      const resp = await fetch('/api/admin/seed-courses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await resp.json();
      setResult(json);
      if (!resp.ok) {
        toast({
          variant: 'destructive',
          title: t.seedFailed,
          description: json?.error || t.unknownError,
        });
      } else {
        toast({
          title: t.seedComplete,
          description:
            lang === 'ar'
              ? `تم تهيئة ${json?.seeded ?? 0} دورة.`
              : `Seeded ${json?.seeded ?? 0} courses.`,
        });
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t.seedError,
        description: e?.message || t.unknownError,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-2xl mx-auto space-y-6">
          <h1 className="font-headline text-3xl md:text-4xl font-bold">
            {t.pageTitle}
          </h1>
          {roleLoading ? (
            <p className="text-muted-foreground">
              {t.checkingPermissions}
            </p>
          ) : canRun ? (
            <>
              <p className="text-muted-foreground">
                {t.description}
              </p>
              <Button onClick={runSeed} disabled={loading} className="w-full">
                {loading ? t.seeding : t.runSeed}
              </Button>
              {result && (
                <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-auto">
{JSON.stringify(result, null, 2)}
                </pre>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              {t.noPermission}
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
