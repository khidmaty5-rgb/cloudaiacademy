'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { doc, getFirestore } from 'firebase/firestore';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import CertificateView from '@/components/certificates/certificate-view';
import { generateCertificatePdfBytes } from '@/lib/certificate-pdf';
import type { Certificate } from '@/types/models';
import { useCurrentRole } from '@/hooks/useCurrentRole';

export default function VerifyCertificatePage() {
  const params = useParams<{ certificateId: string }>();
  const raw = params?.certificateId || '';
  const certificateId = decodeURIComponent(raw);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const { user } = useUser();
  const { isAdmin } = useCurrentRole();

  const firestore = getFirestore();
  const certDocRef = useMemoFirebase(() => {
    if (!certificateId) return null;
    return doc(firestore, 'certificates', certificateId);
  }, [firestore, certificateId]);

  const { data: certificate, isLoading, error } = useDoc<Certificate>(certDocRef);
  const isRevoked = certificate?.status === 'REVOKED';

  const verifyUrl = useMemo(() => {
    if (!certificateId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/verify/${encodeURIComponent(certificateId)}`;
  }, [certificateId]);

  const downloadStoredPdf = async (certificate: Certificate) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Login required',
        description: 'Please login to download this certificate.',
      });
      return;
    }

    setIsDownloading(true);
    try {
      const token = await user.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const resp = await fetch(
        `/api/certificates/${encodeURIComponent(certificate.id)}/download?disposition=attachment`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        throw new Error(json?.error || resp.statusText || 'Download failed');
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificate.id || 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: err?.message || 'Failed to download the PDF.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadGeneratedPdf = async (certificate: Certificate) => {
    if (!verifyUrl) return;
    setIsDownloading(true);
    try {
      const pdfBytes = await generateCertificatePdfBytes({
        certificate,
        verifyUrl,
        templatePdfUrl: null,
        verifiedStampUrl: '/images/stamp.png',
      });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificate.id || 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: err?.message || 'Failed to generate the PDF.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-6xl mx-auto">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-[520px] w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
              {error.message || 'Failed to load certificate.'}
            </div>
          ) : !certificate ? (
            <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
              <h1 className="font-headline text-2xl font-bold">Certificate not found</h1>
              <p className="mt-2 text-muted-foreground">
                Check the certificate ID and try again.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const ownerUid = typeof certificate?.userId === 'string' ? certificate.userId : '';
                const canDownload = !!user && !isRevoked && (isAdmin || (ownerUid && user.uid === ownerUid));

                return (
              <div
                className={[
                  'flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between',
                  isRevoked
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200',
                ].join(' ')}
              >
                <div>
                  {isRevoked ? 'Revoked certificate:' : 'Verified certificate:'}{' '}
                  <span className="font-semibold">{certificate.id}</span>
                </div>
                {isRevoked ? (
                  <p className="text-sm md:text-base">Download is disabled for revoked certificates.</p>
                ) : canDownload ? (
                  <Button
                    type="button"
                    disabled={isDownloading}
                    onClick={() =>
                      certificate.pdfPath ? downloadStoredPdf(certificate) : downloadGeneratedPdf(certificate)
                    }
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isDownloading ? 'Preparing...' : 'Download PDF'}
                  </Button>
                ) : (
                  <p className="text-sm md:text-base">Download is available to the certificate owner or admins.</p>
                )}
              </div>
                );
              })()}
              <CertificateView certificate={certificate} verifyUrl={verifyUrl} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
