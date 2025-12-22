'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import CertificateView from '@/components/certificates/certificate-view';
import { generateCertificatePdfBytes } from '@/lib/certificate-pdf';
import { formatCertificateId, normalizeCourseCode } from '@/lib/certificates';
import type { Certificate, Course, UserProfile } from '@/types/models';

function asDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminCertificatesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = getFirestore();
  const { isAdmin, isTeacher, loading: roleLoading } = useCurrentRole();

  const canView = isAdmin || isTeacher;

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/admin');
  }, [user, isUserLoading, router]);

  const coursesQuery = useMemoFirebase(() => query(collection(firestore, 'courses')), [firestore]);
  const { data: courses, isLoading: coursesLoading, error: coursesError } = useCollection<Course>(coursesQuery);

  const [courseId, setCourseId] = useState<string>('');
  const selectedCourse = useMemo(() => (courses || []).find((c) => c.id === courseId) || null, [courses, courseId]);

  const [studentUid, setStudentUid] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // Admin-only: lookup student profile by email.
  const userLookupQuery = useMemoFirebase(() => {
    const email = studentEmail.trim().toLowerCase();
    if (!isAdmin || !email || !email.includes('@')) return null;
    return query(collection(firestore, 'users'), where('email', '==', email));
  }, [firestore, isAdmin, studentEmail]);
  const { data: matchedUsers, isLoading: userLookupLoading } = useCollection<UserProfile>(userLookupQuery);

  const [completionDate, setCompletionDate] = useState<string>(asDateInputValue(new Date()));
  const [totalHours, setTotalHours] = useState<string>('');
  const [instructorName, setInstructorName] = useState('');
  const [authorizedByName, setAuthorizedByName] = useState('');
  const [sequence, setSequence] = useState<string>('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [generatePdfAfterIssue, setGeneratePdfAfterIssue] = useState(true);
  const [useTemplatePdf, setUseTemplatePdf] = useState(false);

  useEffect(() => {
    // Keep totalHours in sync when switching courses (if course has a value).
    if (!selectedCourse) return;
    if (typeof selectedCourse.totalHours === 'number' && Number.isFinite(selectedCourse.totalHours)) {
      setTotalHours(String(selectedCourse.totalHours));
    }
    if (!instructorName) {
      // Best-effort default for the signature.
      setInstructorName(user?.displayName || '');
    }
  }, [selectedCourse, instructorName, user?.displayName]);

  const courseCode = selectedCourse?.courseCode ? normalizeCourseCode(selectedCourse.courseCode) : '';
  const year = useMemo(() => {
    const d = new Date(`${completionDate}T00:00:00`);
    return Number.isFinite(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  }, [completionDate]);

  const certificateIdPreview = useMemo(() => {
    const seq = Number(sequence);
    if (!courseCode || !Number.isInteger(seq) || seq < 0) return '';
    try {
      return formatCertificateId({ prefix: 'CA', year, courseCode, sequence: seq, sequenceWidth: 6 });
    } catch {
      return '';
    }
  }, [courseCode, sequence, year]);

  const verifyUrlPreview = useMemo(() => {
    if (!certificateIdPreview) return '';
    const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    const origin = site || (typeof window !== 'undefined' ? window.location.origin : '');
    return origin ? `${origin}/verify/${encodeURIComponent(certificateIdPreview)}` : '';
  }, [certificateIdPreview]);

  const previewCertificate: Certificate | null = useMemo(() => {
    if (!certificateIdPreview || !selectedCourse) return null;
    const hours = Number(totalHours);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    const completedAt = new Date(`${completionDate}T00:00:00`);
    if (!Number.isFinite(completedAt.getTime())) return null;
    if (!studentName.trim()) return null;
    if (!authorizedByName.trim()) return null;
    if (!instructorName.trim()) return null;

    return {
      id: certificateIdPreview,
      userId: studentUid.trim(),
      userName: studentName.trim(),
      userEmail: studentEmail.trim() || null,
      courseId: selectedCourse.id,
      courseTitle: selectedCourse.title,
      courseCode,
      totalHours: Math.round(hours),
      completedAt,
      issuedAt: null,
      issuedBy: 'CloudAI Academy',
      instructorName: instructorName.trim(),
      instructorTitle: 'Instructor / Director',
      authorizedByName: authorizedByName.trim(),
      authorizedByTitle: 'Authorized Signature',
      status: 'ACTIVE',
      createdAt: null,
      updatedAt: null,
    };
  }, [
    authorizedByName,
    certificateIdPreview,
    completionDate,
    courseCode,
    instructorName,
    selectedCourse,
    studentEmail,
    studentName,
    studentUid,
    totalHours,
  ]);

  const handleUseMatchedUser = () => {
    const u = (matchedUsers || [])[0] as any;
    if (!u) return;
    setStudentUid(u.id);
    setStudentName(`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || studentName);
    setStudentEmail(u.email || studentEmail);
  };

  const issueCertificate = async () => {
    if (!user) return;
    if (!previewCertificate) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill all required certificate fields (including Course Code, hours, names, and sequence).',
      });
      return;
    }
    if (!previewCertificate.userId) {
      toast({
        variant: 'destructive',
        title: 'Student UID required',
        description: 'Enter the student UID (or use email lookup as admin).',
      });
      return;
    }

    setIsIssuing(true);
    try {
      const certRef = doc(firestore, 'certificates', previewCertificate.id);
      const existing = await getDoc(certRef);
      if (existing.exists()) {
        toast({
          variant: 'destructive',
          title: 'Certificate ID already exists',
          description: 'Pick a different sequence number so the ID is unique.',
        });
        return;
      }

      const userCertRef = doc(firestore, 'users', previewCertificate.userId, 'certificates', previewCertificate.id);
      const payload: Omit<Certificate, 'issuedAt' | 'createdAt' | 'updatedAt'> & {
        issuedAt: any;
        createdAt: any;
        updatedAt: any;
      } = {
        ...previewCertificate,
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(firestore);
      batch.set(certRef, payload, { merge: false });
      batch.set(userCertRef, payload, { merge: false });
      await batch.commit();

      if (generatePdfAfterIssue) {
        try {
          const token = await user.getIdToken();
          if (!token) throw new Error('Unauthorized');

          const site = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
          const origin = site || (typeof window !== 'undefined' ? window.location.origin : '');
          const verifyUrl = origin ? `${origin}/verify/${encodeURIComponent(previewCertificate.id)}` : '';

          const pdfBytes = await generateCertificatePdfBytes({
            certificate: previewCertificate,
            verifyUrl,
            templatePdfUrl: useTemplatePdf ? '/CloudAI_Certificate1.pdf' : null,
          });

          const presignResp = await fetch('/api/certificates/presign-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              certificateId: previewCertificate.id,
              studentUid: previewCertificate.userId,
              contentType: 'application/pdf',
            }),
          });
          const presignJson = await presignResp.json().catch(() => ({}));
          if (!presignResp.ok) {
            throw new Error(presignJson?.error || 'Failed to create upload URL');
          }

          const uploadUrl = presignJson.url as string | undefined;
          const key = presignJson.key as string | undefined;
          if (!uploadUrl || !key) throw new Error('Invalid presign response');

          const putResp = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/pdf' },
            body: new Blob([pdfBytes], { type: 'application/pdf' }),
          });
          if (!putResp.ok) {
            throw new Error(`PDF upload failed (${putResp.status})`);
          }

          const pdfUrl = `/api/certificates/${encodeURIComponent(previewCertificate.id)}/download`;
          const patch = {
            pdfPath: key,
            pdfUrl,
            updatedAt: serverTimestamp(),
          };
          const after = writeBatch(firestore);
          after.update(certRef, patch);
          after.update(userCertRef, patch);
          await after.commit();
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'PDF generation/upload failed',
            description: err?.message || String(err),
          });
        }
      }

      toast({
        title: 'Certificate issued',
        description: previewCertificate.id,
      });

      router.push(`/verify/${encodeURIComponent(previewCertificate.id)}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Issue failed',
        description: err?.message || 'Failed to issue certificate.',
      });
    } finally {
      setIsIssuing(false);
    }
  };

  if (isUserLoading || roleLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold">Issue Certificate</h1>
            <p className="mt-2 text-muted-foreground">
              Create a certificate of completion that can be verified publicly.
            </p>
          </div>

          {!canView ? (
            <div className="text-center py-16 text-muted-foreground">No permission.</div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Certificate Details</CardTitle>
                  <CardDescription>
                    This will create two records: `certificates/{'{id}'}`
                    (public verification) and `users/{'{uid}'}/certificates/{'{id}'}`
                    (student view).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {coursesError && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                      {coursesError.message || 'Failed to load courses.'}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="courseId">Course</Label>
                    {coursesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <select
                        id="courseId"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                      >
                        <option value="">Select a course</option>
                        {(courses || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedCourse && (
                      <p className="text-xs text-muted-foreground">
                        Course code: <span className="font-medium text-foreground">{courseCode || '—'}</span>
                        {courseCode ? '' : ' (set this in the course editor first)'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="completionDate">Completion date</Label>
                      <Input
                        id="completionDate"
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalHours">Total hours</Label>
                      <Input
                        id="totalHours"
                        inputMode="numeric"
                        placeholder="e.g., 15"
                        value={totalHours}
                        onChange={(e) => setTotalHours(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sequence">Sequential number</Label>
                    <Input
                      id="sequence"
                      inputMode="numeric"
                      placeholder="e.g., 127"
                      value={sequence}
                      onChange={(e) => setSequence(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Certificate ID format: <span className="font-mono">CA-YYYY-COURSECODE-000123</span>
                    </p>
                    {certificateIdPreview && (
                      <p className="text-sm">
                        Preview ID: <span className="font-mono font-semibold">{certificateIdPreview}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentUid">Student UID</Label>
                    <Input
                      id="studentUid"
                      placeholder="Firebase uid"
                      value={studentUid}
                      onChange={(e) => setStudentUid(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentName">Student name</Label>
                    <Input
                      id="studentName"
                      placeholder="e.g., Fateh Adhnouss"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="studentEmail">Student email (optional)</Label>
                    <Input
                      id="studentEmail"
                      type="email"
                      placeholder="student@example.com"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                    />
                    {isAdmin && studentEmail.trim() && (
                      <div className="text-xs text-muted-foreground">
                        {userLookupLoading ? (
                          'Looking up user...'
                        ) : matchedUsers && matchedUsers.length > 0 ? (
                          <div className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-3 py-2">
                            <span>
                              Found: {(matchedUsers[0] as any)?.firstName ?? ''} {(matchedUsers[0] as any)?.lastName ?? ''} • {(matchedUsers[0] as any)?.id}
                            </span>
                            <Button type="button" variant="secondary" size="sm" onClick={handleUseMatchedUser}>
                              Use
                            </Button>
                          </div>
                        ) : (
                          'No user found for that email (make sure a profile exists in /users).'
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="instructorName">Instructor / Director name</Label>
                      <Input
                        id="instructorName"
                        placeholder="e.g., John Smith"
                        value={instructorName}
                        onChange={(e) => setInstructorName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="authorizedByName">Authorized signature name</Label>
                      <Input
                        id="authorizedByName"
                        placeholder="e.g., John Smith"
                        value={authorizedByName}
                        onChange={(e) => setAuthorizedByName(e.target.value)}
                      />
                    </div>
                  </div>

                  {verifyUrlPreview && (
                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      Verify URL:{' '}
                      <Link className="break-all text-accent hover:underline" href={verifyUrlPreview}>
                        {verifyUrlPreview}
                      </Link>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Button
                      type="button"
                      onClick={issueCertificate}
                      disabled={isIssuing || !previewCertificate}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      {isIssuing ? 'Issuing...' : 'Issue Certificate'}
                    </Button>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent"
                        checked={generatePdfAfterIssue}
                        onChange={(e) => setGeneratePdfAfterIssue(e.target.checked)}
                      />
                      Generate PDF and store it
                    </label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent"
                        checked={useTemplatePdf}
                        disabled={!generatePdfAfterIssue}
                        onChange={(e) => setUseTemplatePdf(e.target.checked)}
                      />
                      Use PDF template (CloudAI_Certificate1.pdf)
                    </label>
                  </div>
                  {previewCertificate && (
                    <span className="text-xs text-muted-foreground">
                      Ready to issue: <span className="font-mono">{previewCertificate.id}</span>
                    </span>
                  )}
                </CardFooter>
              </Card>

              <div className="space-y-4">
                <div>
                  <h2 className="font-headline text-2xl font-bold">Preview</h2>
                  <p className="text-muted-foreground">
                    This is what the certificate will look like.
                  </p>
                </div>
                {previewCertificate ? (
                  <CertificateView certificate={previewCertificate} verifyUrl={verifyUrlPreview || ''} />
                ) : (
                  <div className="rounded-md border bg-muted/20 p-6 text-center text-muted-foreground">
                    Fill the form to see a preview.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
