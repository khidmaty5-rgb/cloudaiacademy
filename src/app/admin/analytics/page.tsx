'use client';

import Link from 'next/link';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { getEvidenceUrl } from '@/lib/evidence';

export default function AdminAnalyticsPage() {
  const { isAdmin, loading } = useCurrentRole();

  // Loading shim to keep UX consistent with other admin pages
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-6xl mx-auto">
            <div className="h-8 w-1/3 bg-muted animate-pulse rounded mb-4" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="max-w-xl mx-auto text-center">
            <h1 className="font-headline text-3xl md:text-4xl font-bold mb-4">Access denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view this page.</p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/">Go Home</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const studentProgressUrl = getEvidenceUrl('/student-progress');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-6 md:px-6 md:py-10 max-w-7xl">
          <div className="mb-6">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">Analytics & Insights</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Evidence.dev dashboards with key CloudAI Academy metrics like student progress and course engagement.
            </p>
          </div>

          <Card className="border-accent">
            <CardHeader>
              <CardTitle>Student Progress</CardTitle>
              <CardDescription>Overview of learner progress across courses.</CardDescription>
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
                  <a href={studentProgressUrl} target="_blank" rel="noopener noreferrer">Open full-screen</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
