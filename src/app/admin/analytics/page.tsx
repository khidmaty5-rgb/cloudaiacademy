'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { getEvidenceUrl } from '@/lib/evidence';
import { useLang } from '@/components/i18n/lang';

export default function AdminAnalyticsPage() {
  const { isAdmin, loading } = useCurrentRole();
  const { lang } = useLang();
  const ar = lang === 'ar';

  // Loading shim to keep UX consistent with other admin pages
  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-6xl mx-auto">
            <div className="h-8 w-1/3 bg-muted animate-pulse rounded mb-4" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-xl mx-auto text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold mb-4">{ar ? 'الوصول مرفوض' : 'Access denied'}</h1>
            <p className="text-muted-foreground mb-6">{ar ? 'لا تملك صلاحية عرض هذه الصفحة.' : 'You do not have permission to view this page.'}</p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/">{ar ? 'الصفحة الرئيسية' : 'Go Home'}</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">{ar ? 'لوحة التحكم' : 'Go to Dashboard'}</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const studentProgressUrl = getEvidenceUrl('/student-progress');

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
      <main className="flex-1">
        <div className="container px-4 py-6 md:px-6 md:py-10 max-w-7xl">
          <div className="mb-6">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">{ar ? 'التحليلات والرؤى' : 'Analytics & Insights'}</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              {ar ? 'لوحات بيانات تعرض مؤشرات CloudAI Academy الأساسية مثل تقدم الطلاب والتفاعل مع الدورات.' : 'Evidence.dev dashboards with key CloudAI Academy metrics like student progress and course engagement.'}
            </p>
          </div>

          <Card className="border-accent">
            <CardHeader>
              <CardTitle>{ar ? 'تقدم الطلاب' : 'Student Progress'}</CardTitle>
              <CardDescription>{ar ? 'نظرة عامة على تقدم المتعلمين في الدورات.' : 'Overview of learner progress across courses.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-hidden rounded-xl">
                <iframe
                  src={studentProgressUrl}
                  className="w-full h-[800px] border rounded-xl bg-white"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <a href={studentProgressUrl} target="_blank" rel="noopener noreferrer">{ar ? 'فتح بملء الشاشة' : 'Open full-screen'}</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
