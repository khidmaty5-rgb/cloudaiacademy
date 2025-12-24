'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, getFirestore, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Certificate } from '@/types/models';

function toDateValue(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function CertificatesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const certsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'certificates'),
      orderBy('completedAt', 'desc'),
    );
  }, [firestore, user]);

  const { data: certificates, isLoading, error } = useCollection<Certificate>(certsQuery);

  const items = useMemo(() => certificates || [], [certificates]);

  if (isUserLoading || !user) {
    return (
      <div className="w-full max-w-4xl px-4 py-10 md:px-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl px-4 py-10 md:px-6">
      <h1 className="font-headline text-3xl md:text-4xl font-bold">Certificates</h1>
      <p className="mt-2 text-muted-foreground">
        Your certificates of completion.
      </p>

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            {error.message || 'Failed to load certificates.'}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
            <p className="text-muted-foreground">No certificates yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((cert) => {
              const completedAt = toDateValue(cert.completedAt);
              const completedLabel = completedAt ? format(completedAt, 'PPP') : '-';
              const verifyHref = `/verify/${encodeURIComponent(cert.id)}`;
              const isRevoked = cert.status === 'REVOKED';
              return (
                <Card key={cert.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="font-headline text-xl">{cert.courseTitle}</CardTitle>
                      {isRevoked ? <Badge variant="destructive">Revoked</Badge> : null}
                    </div>
                    <CardDescription>
                      Completed {completedLabel} | {cert.totalHours} hours
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                      Certificate ID: <span className="font-medium text-foreground">{cert.id}</span>
                    </div>
                    <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Link href={verifyHref}>View / Verify</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
