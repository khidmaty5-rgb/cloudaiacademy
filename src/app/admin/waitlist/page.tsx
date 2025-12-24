'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collectionGroup,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { setEnrollmentRequestStatus } from '@/lib/enrollment-requests';
import type { EnrollmentRequest, EnrollmentRequestStatus } from '@/types/models';

function toDateLabel(v: any): string {
  if (!v) return '-';
  const d =
    typeof v?.toDate === 'function'
      ? v.toDate()
      : v instanceof Date
        ? v
        : typeof v === 'number'
          ? new Date(v)
          : typeof v === 'string'
            ? new Date(v)
            : null;
  if (!d || isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

export default function AdminWaitlistPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const { toast } = useToast();
  const { isAdmin, isTeacher, loading: roleLoading } = useCurrentRole();
  const canView = isAdmin || isTeacher;

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/admin');
  }, [user, isUserLoading, router]);

  const requestsQuery = useMemoFirebase(() => {
    if (!canView) return null;
    return query(
      collectionGroup(firestore, 'enrollmentRequests'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
  }, [firestore, canView]);
  const { data: requests, isLoading: requestsLoading, error: requestsError } =
    useCollection<EnrollmentRequest>(requestsQuery);

  const [filter, setFilter] = useState('');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    const list = requests || [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const hay = `${r.userId} ${r.userName ?? ''} ${r.userEmail ?? ''} ${r.courseId} ${r.courseTitle ?? ''} ${r.courseCode ?? ''} ${r.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requests, filter]);

  const updateStatus = async (r: EnrollmentRequest, status: EnrollmentRequestStatus) => {
    if (!r.userId || !r.courseId) return;
    const key = `${r.userId}|${r.courseId}`;
    setUpdatingKey(key);
    try {
      await setEnrollmentRequestStatus({ userId: r.userId, courseId: r.courseId, status });
      toast({ title: 'Updated', description: `Set status to ${status}.` });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err?.message || 'Could not update request.',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  if (roleLoading || (canView && requestsLoading && !requests)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto">
            <Card className="border-destructive/30 bg-destructive/10">
              <CardHeader>
                <CardTitle>No permission</CardTitle>
                <CardDescription>You do not have access to this page.</CardDescription>
              </CardHeader>
            </Card>
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
        <div className="container max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="font-headline text-3xl font-bold">Enrollment Waitlist</h1>
            <p className="text-muted-foreground">
              Review and approve student enrollment requests.
            </p>
          </div>

          <Card className="border-accent">
            <CardHeader>
              <CardTitle>Requests (recent)</CardTitle>
              <CardDescription>
                Showing the latest 50 requests. Use search to filter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search by student, email, course, code, status..."
              />

              {requestsError ? (
                <div className="text-sm text-destructive">
                  {requestsError.message || 'Failed to load requests.'}
                </div>
              ) : null}

              {filteredRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((r) => {
                    const key = `${r.userId}|${r.courseId}`;
                    const isUpdating = updatingKey === key;
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-muted p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {r.userName || r.userEmail || r.userId}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {r.userEmail ? r.userEmail : r.userId}
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Course:</span>{' '}
                            {r.courseTitle || r.courseId}
                            {r.courseCode ? ` (${r.courseCode})` : ''}
                          </div>
                          <div className="mt-1 text-sm">
                            <span className="font-medium">Status:</span>{' '}
                            <span className="font-mono">{r.status}</span>
                            <span className="text-muted-foreground">
                              {' '}
                              • requested {toDateLabel(r.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            variant="outline"
                            disabled={isUpdating || r.status === 'APPROVED'}
                            onClick={() => updateStatus(r, 'APPROVED')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            disabled={isUpdating || r.status === 'REJECTED'}
                            onClick={() => updateStatus(r, 'REJECTED')}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

