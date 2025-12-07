'use client';

import { useState, useEffect } from 'react';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createAnnouncement } from '@/lib/announcements';
import { doc, getFirestore } from 'firebase/firestore';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { useLang } from '@/components/i18n/lang';

export default function CreateAnnouncementPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = getFirestore();
  const { lang } = useLang();
  const t = {
    en: {
      pageTitle: 'Create Announcement',
      pageSubtitle: 'Share an update with all students.',
      newAnnouncement: 'New Announcement',
      announcementDesc: 'This will be visible to everyone on their dashboard.',
      titleLabel: 'Title',
      titlePlaceholder: "e.g., 'New Course Available!'",
      bodyLabel: 'Body',
      bodyPlaceholder: 'Write your announcement content here...',
      publishButton: 'Publish Announcement',
      publishing: 'Publishing...',
      authErrorTitle: 'Authentication Error',
      authErrorDesc: 'You must be logged in to create an announcement.',
      publishedTitle: 'Announcement Published!',
      publishedDesc: 'Your announcement is now live for all users.',
      publishFailedTitle: 'Publishing Failed',
      publishFailedDesc: 'Could not publish the announcement.',
      noPermission: 'You do not have permission to view this page.',
    },
    ar: {
      pageTitle: 'إنشاء إعلان',
      pageSubtitle: 'شارك تحديثًا مع جميع الطلاب.',
      newAnnouncement: 'إعلان جديد',
      announcementDesc: 'سيظهر هذا الإعلان لجميع المستخدمين في لوحة التحكم لديهم.',
      titleLabel: 'العنوان',
      titlePlaceholder: "مثال: 'دورة جديدة متاحة!'",
      bodyLabel: 'المحتوى',
      bodyPlaceholder: 'اكتب محتوى الإعلان هنا...',
      publishButton: 'نشر الإعلان',
      publishing: 'جارٍ النشر...',
      authErrorTitle: 'خطأ في المصادقة',
      authErrorDesc: 'يجب تسجيل الدخول لإنشاء إعلان.',
      publishedTitle: 'تم نشر الإعلان!',
      publishedDesc: 'أصبح إعلانك الآن ظاهرًا لجميع المستخدمين.',
      publishFailedTitle: 'فشل النشر',
      publishFailedDesc: 'تعذر نشر الإعلان.',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
    },
  }[lang];

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);
  const [hasAdminOrTeacherClaim, setHasAdminOrTeacherClaim] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkClaims() {
      if (!user) { if (!cancelled) setHasAdminOrTeacherClaim(false); return; }
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
    return () => { cancelled = true };
  }, [user]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) { setHasAdminOrTeacherClaim(false); return; }
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

  useEffect(() => {
    if (isUserLoading || isProfileLoading || hasAdminOrTeacherClaim === null) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // Do not redirect on lack of permission; show a message instead.
  }, [user, isUserLoading, isProfileLoading, hasAdminOrTeacherClaim, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: 'destructive',
        title: t.authErrorTitle,
        description: t.authErrorDesc,
      });
      return;
    }
    setIsLoading(true);
    try {
      await createAnnouncement({ title, body, createdBy: user.uid });
      toast({
        title: t.publishedTitle,
        description: t.publishedDesc,
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.publishFailedTitle,
        description: error.message || t.publishFailedDesc,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isUserLoading || isProfileLoading || hasAdminOrTeacherClaim === null || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
          <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-8 w-1/2 mb-8" />
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const canView = (userProfile?.role === 'admin' || userProfile?.role === 'teacher' || hasAdminOrTeacherClaim === true);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-2xl mx-auto">
          {canView ? (
            <>
              <h1 className="font-headline text-3xl md:text-4xl font-bold">
                {t.pageTitle}
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                {t.pageSubtitle}
              </p>
              <Card className="mt-8">
                <form onSubmit={handleSubmit}>
                  <CardHeader>
                    <CardTitle>{t.newAnnouncement}</CardTitle>
                    <CardDescription>
                      {t.announcementDesc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">{t.titleLabel}</Label>
                      <Input
                        id="title"
                        placeholder={t.titlePlaceholder}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="body">{t.bodyLabel}</Label>
                      <Textarea
                        id="body"
                        placeholder={t.bodyPlaceholder}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={8}
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                      disabled={isLoading || !title || !body}
                    >
                      {isLoading ? t.publishing : t.publishButton}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
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
