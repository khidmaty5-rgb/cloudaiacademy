'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAt,
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
import type { Certificate, CertificateRecipientNameStyle, Course, UserProfile } from '@/types/models';

function asDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type CertificateListItem = {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  status: string;
  issuedAtMillis: number;
  completedAtMillis: number;
  pdfPath: string | null;
};

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
  const [recipientNameStyle, setRecipientNameStyle] =
    useState<CertificateRecipientNameStyle>('CALLIGRAPHY');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<UserProfile[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const studentSearchRequestIdRef = useRef(0);

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
  const [sequenceAutoKey, setSequenceAutoKey] = useState<string>('');
  const [sequenceAutoLoading, setSequenceAutoLoading] = useState(false);
  const [sequenceAutoError, setSequenceAutoError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [generatePdfAfterIssue, setGeneratePdfAfterIssue] = useState(true);
  const [useTemplatePdf, setUseTemplatePdf] = useState(false);
  const [deleteCertificateId, setDeleteCertificateId] = useState('');
  const [deleteStudentUid, setDeleteStudentUid] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [allCertificates, setAllCertificates] = useState<CertificateListItem[] | null>(null);
  const [allCertificatesLoading, setAllCertificatesLoading] = useState(false);
  const [allCertificatesError, setAllCertificatesError] = useState<string | null>(null);
  const [allCertificatesFilter, setAllCertificatesFilter] = useState('');
  const [allCertificatesCursor, setAllCertificatesCursor] = useState<string | null>(null);
  const [allCertificatesHasMore, setAllCertificatesHasMore] = useState(false);

  const deleteListQuery = useMemoFirebase(() => {
    const uid = deleteStudentUid.trim();
    if (!uid) return null;
    return query(
      collection(firestore, 'users', uid, 'certificates'),
      orderBy('issuedAt', 'desc'),
      limit(50),
    );
  }, [firestore, deleteStudentUid]);
  const {
    data: deleteCandidates,
    isLoading: deleteCandidatesLoading,
    error: deleteCandidatesError,
  } = useCollection<Certificate>(deleteListQuery);

  const filteredAllCertificates = useMemo(() => {
    if (!allCertificates) return null;
    const q = allCertificatesFilter.trim().toLowerCase();
    if (!q) return allCertificates;
    return allCertificates.filter((c) => {
      const hay = `${c.id} ${c.userName} ${c.courseTitle} ${c.courseCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allCertificates, allCertificatesFilter]);

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

  const sequenceScopeKey = courseCode ? `${year}|${courseCode}` : '';
  const sequenceScopeKeyRef = useRef<string>('');
  sequenceScopeKeyRef.current = sequenceScopeKey;
  const nextSequenceRequestIdRef = useRef(0);

  useEffect(() => {
    if (!user || !canView) return;
    if (!sequenceScopeKey) return;
    if (sequence && sequenceAutoKey === sequenceScopeKey) return;

    const requestId = ++nextSequenceRequestIdRef.current;
    const requestedKey = sequenceScopeKey;

    setSequenceAutoLoading(true);
    setSequenceAutoError(null);

    (async () => {
      try {
        const token = await user.getIdToken();
        if (!token) throw new Error('Unauthorized');

        const resp = await fetch('/api/certificates/next-sequence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ year, courseCode }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || 'Failed to allocate a sequence number.');

        const seq = json?.sequence;
        if (!Number.isInteger(seq) || seq < 0) throw new Error('Invalid sequence response.');

        if (nextSequenceRequestIdRef.current !== requestId) return;
        if (sequenceScopeKeyRef.current !== requestedKey) return;

        setSequence(String(seq));
        setSequenceAutoKey(requestedKey);
      } catch (err: any) {
        if (nextSequenceRequestIdRef.current !== requestId) return;
        setSequenceAutoError(err?.message || String(err));
      } finally {
        if (nextSequenceRequestIdRef.current !== requestId) return;
        setSequenceAutoLoading(false);
      }
    })();
  }, [user, canView, courseCode, year, sequence, sequenceAutoKey, sequenceScopeKey]);

  const refreshSequence = async () => {
    if (!user || !canView) return;
    if (!sequenceScopeKey) return;
    if (sequenceAutoLoading) return;

    const requestId = ++nextSequenceRequestIdRef.current;
    const requestedKey = sequenceScopeKey;

    setSequenceAutoLoading(true);
    setSequenceAutoError(null);
    try {
      const token = await user.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const resp = await fetch('/api/certificates/next-sequence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ year, courseCode }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Failed to allocate a sequence number.');

      const seq = json?.sequence;
      if (!Number.isInteger(seq) || seq < 0) throw new Error('Invalid sequence response.');

      if (nextSequenceRequestIdRef.current !== requestId) return;
      if (sequenceScopeKeyRef.current !== requestedKey) return;

      setSequence(String(seq));
      setSequenceAutoKey(requestedKey);
    } catch (err: any) {
      if (nextSequenceRequestIdRef.current !== requestId) return;
      setSequenceAutoError(err?.message || String(err));
    } finally {
      if (nextSequenceRequestIdRef.current !== requestId) return;
      setSequenceAutoLoading(false);
    }
  };

  const certificateIdPreview = useMemo(() => {
    const raw = sequence.trim();
    if (!courseCode || !raw || !/^\d+$/.test(raw)) return '';
    const seq = Number.parseInt(raw, 10);
    if (!Number.isInteger(seq) || seq < 1) return '';
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
        recipientNameStyle,
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
      recipientNameStyle,
      selectedCourse,
      studentEmail,
      studentName,
      studentUid,
      totalHours,
  ]);

  const applySelectedUser = (u: Partial<UserProfile> & { id?: string } | null | undefined) => {
    if (!u || !u.id) return;
    const fullName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    setStudentUid(u.id);
    if (fullName) setStudentName(fullName);
    if (u.email) setStudentEmail(u.email);
  };

  const handleUseMatchedUser = () => {
    const u = (matchedUsers || [])[0] as any;
    applySelectedUser(u);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const termRaw = studentSearch.trim();
    if (termRaw.length < 2) {
      setStudentSearchResults([]);
      setStudentSearchError(null);
      setStudentSearchLoading(false);
      return;
    }

    const requestId = ++studentSearchRequestIdRef.current;
    const debounce = setTimeout(async () => {
      setStudentSearchLoading(true);
      setStudentSearchError(null);
      try {
        const usersCol = collection(firestore, 'users');
        const maxPerQuery = 8;
        const term = termRaw.replace(/\s+/g, ' ').trim();
        const termLower = term.toLowerCase();
        const parts = termLower.split(' ').filter(Boolean);

        const toTitle = (input: string) =>
          input
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        const firstPart = parts[0] || '';
        const secondPart = parts.length > 1 ? parts[parts.length - 1] : '';

        const fetchPrefix = async (field: 'email' | 'firstName' | 'lastName', prefix: string) => {
          const safe = prefix.trim();
          if (!safe) return [] as UserProfile[];
          const snap = await getDocs(
            query(
              usersCol,
              orderBy(field),
              startAt(safe),
              endAt(`${safe}\uf8ff`),
              limit(maxPerQuery),
            ),
          );
          return snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }) as UserProfile)
            .filter((u) => u.role === 'student');
        };

        const emailHits = await fetchPrefix('email', termLower);

        let hits: UserProfile[] = [];
        if (term.includes('@') || term.includes('.')) {
          hits = emailHits;
        } else {
          const firstKey = toTitle(firstPart);
          const lastKey = toTitle(secondPart || firstPart);

          const [firstHits, lastHits] = await Promise.all([
            fetchPrefix('firstName', firstKey),
            fetchPrefix('lastName', lastKey),
          ]);

          const merged = new Map<string, UserProfile>();
          const pushAll = (arr: UserProfile[]) => arr.forEach((u) => merged.set(u.id, u));

          if (secondPart) {
            const firstIds = new Set(firstHits.map((u) => u.id));
            const lastIds = new Set(lastHits.map((u) => u.id));
            pushAll(firstHits.filter((u) => lastIds.has(u.id)));
            pushAll(lastHits.filter((u) => firstIds.has(u.id)));
            pushAll(emailHits);
            if (merged.size === 0) {
              pushAll(firstHits);
              pushAll(lastHits);
            }
          } else {
            pushAll(firstHits);
            pushAll(lastHits);
            pushAll(emailHits);
          }

          hits = Array.from(merged.values()).slice(0, 12);
        }

        if (studentSearchRequestIdRef.current !== requestId) return;
        setStudentSearchResults(hits);
      } catch (err: any) {
        if (studentSearchRequestIdRef.current !== requestId) return;
        setStudentSearchError(err?.message || String(err));
        setStudentSearchResults([]);
      } finally {
        if (studentSearchRequestIdRef.current !== requestId) return;
        setStudentSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [firestore, isAdmin, studentSearch]);

  const ALL_CERTS_PAGE_SIZE = 200;

  const loadAllCertificates = async (options?: { append?: boolean }) => {
    if (!user) return;
    const append = options?.append === true;
    const cursor = append ? allCertificatesCursor : null;
    if (append && !cursor) return;

    setAllCertificatesLoading(true);
    setAllCertificatesError(null);
    try {
      const token = await user.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const url = cursor
        ? `/api/certificates/list?limit=${ALL_CERTS_PAGE_SIZE}&startAfter=${encodeURIComponent(cursor)}`
        : `/api/certificates/list?limit=${ALL_CERTS_PAGE_SIZE}`;

      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || 'Failed to load certificates.');

      const items = Array.isArray(json?.certificates) ? (json.certificates as CertificateListItem[]) : [];
      const nextCursor = typeof json?.nextCursor === 'string' ? (json.nextCursor as string) : null;
      const hasMore = items.length === ALL_CERTS_PAGE_SIZE && !!nextCursor;

      setAllCertificates((prev) => {
        if (!append || !prev) return items;
        const existingIds = new Set(prev.map((c) => c.id));
        const merged = [...prev];
        for (const item of items) {
          if (existingIds.has(item.id)) continue;
          merged.push(item);
          existingIds.add(item.id);
        }
        return merged;
      });
      setAllCertificatesCursor(nextCursor);
      setAllCertificatesHasMore(hasMore);
    } catch (err: any) {
      setAllCertificatesError(err?.message || String(err));
    } finally {
      setAllCertificatesLoading(false);
    }
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

  const deleteCertificate = async () => {
    const id = deleteCertificateId.trim();
    if (!id) {
      toast({
        variant: 'destructive',
        title: 'Certificate ID required',
        description: 'Enter the certificate ID you want to delete.',
      });
      return;
    }

    setIsDeleting(true);
    try {
      if (!user) throw new Error('Unauthorized');

      const certRef = doc(firestore, 'certificates', id);
      const snap = await getDoc(certRef);
      if (!snap.exists()) {
        toast({
          variant: 'destructive',
          title: 'Not found',
          description: `No certificate found with ID: ${id}`,
        });
        return;
      }

      const data = snap.data() as any;
      const studentUid = typeof data?.userId === 'string' ? data.userId : '';
      const userName = typeof data?.userName === 'string' ? data.userName : '';
      const courseTitle = typeof data?.courseTitle === 'string' ? data.courseTitle : '';
      const pdfPath = typeof data?.pdfPath === 'string' ? data.pdfPath : '';

      const ok = window.confirm(
        `Delete certificate?\n\nID: ${id}` +
          (userName ? `\nStudent: ${userName}` : '') +
          (courseTitle ? `\nCourse: ${courseTitle}` : '') +
          (pdfPath ? `\n\nStorage PDF: ${pdfPath}` : '') +
          `\n\nThis cannot be undone.`,
      );
      if (!ok) return;

      // Best-effort: delete the PDF from storage first (to avoid orphaned objects).
      if (studentUid || pdfPath) {
        try {
          const token = await user.getIdToken();
          const resp = await fetch('/api/certificates/delete-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              certificateId: id,
              studentUid,
              pdfPath: pdfPath || null,
            }),
          });
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            const proceed = window.confirm(
              `Could not delete the PDF from storage.\n\n${json?.error || resp.statusText}\n\nDelete Firestore records anyway?`,
            );
            if (!proceed) return;
          }
        } catch (err: any) {
          const proceed = window.confirm(
            `Could not delete the PDF from storage.\n\n${err?.message || String(err)}\n\nDelete Firestore records anyway?`,
          );
          if (!proceed) return;
        }
      }

      const batch = writeBatch(firestore);
      batch.delete(certRef);
      if (studentUid) {
        batch.delete(doc(firestore, 'users', studentUid, 'certificates', id));
      }
      await batch.commit();

      toast({
        title: 'Certificate deleted',
        description: id,
      });
      setDeleteCertificateId('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err?.message || 'Failed to delete certificate.',
      });
    } finally {
      setIsDeleting(false);
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
              <div className="space-y-6">
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
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="sequence">Sequential number</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={refreshSequence}
                        disabled={sequenceAutoLoading || !courseCode}
                      >
                        {sequenceAutoLoading ? 'Loading...' : 'Next'}
                      </Button>
                    </div>
                    <Input
                      id="sequence"
                      inputMode="numeric"
                      placeholder={courseCode ? 'Auto' : 'Set course code first'}
                      value={sequence}
                      onChange={(e) => setSequence(e.target.value)}
                      disabled={sequenceAutoLoading || !courseCode}
                    />
                    <p className="text-xs text-muted-foreground">
                      Certificate ID format: <span className="font-mono">CA-YYYY-COURSECODE-000123</span>
                    </p>
                    {sequenceAutoError ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                        {sequenceAutoError}
                      </div>
                    ) : null}
                    {certificateIdPreview && (
                      <p className="text-sm">
                        Preview ID: <span className="font-mono font-semibold">{certificateIdPreview}</span>
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="studentSearch">Select student (admin)</Label>
                      <Input
                        id="studentSearch"
                        placeholder="Type name or email to search..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                      {studentSearchLoading ? (
                        <p className="text-xs text-muted-foreground">Searching...</p>
                      ) : studentSearchError ? (
                        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                          {studentSearchError}
                        </div>
                      ) : studentSearchResults.length > 0 ? (
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue=""
                          onChange={(e) => {
                            const uid = e.target.value;
                            const selected = studentSearchResults.find((u) => u.id === uid);
                            applySelectedUser(selected);
                          }}
                        >
                          <option value="">Choose a student...</option>
                          {studentSearchResults.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.firstName || '') + ' ' + (u.lastName || '')} — {u.email || u.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Type at least 2 characters to search students.
                        </p>
                      )}
                    </div>
                  )}

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
                    <Label htmlFor="recipientNameStyle">Name font</Label>
                    <select
                      id="recipientNameStyle"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={recipientNameStyle}
                      onChange={(e) => setRecipientNameStyle(e.target.value as CertificateRecipientNameStyle)}
                    >
                      <option value="CALLIGRAPHY">Calligraphy (default)</option>
                      <option value="GABRIOLA">Gabriola (elegant)</option>
                      <option value="EDWARDIAN">Edwardian Script (classic)</option>
                      <option value="FRENCH_SCRIPT">French Script (bold)</option>
                      <option value="SANS">Bold (Sans)</option>
                      <option value="SERIF">Serif</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      These script fonts depend on what’s installed on the device; missing fonts will fall back.
                    </p>
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

                <Card>
                  <CardHeader>
                    <CardTitle>Delete Test Certificates</CardTitle>
                    <CardDescription>
                      Delete a certificate by ID (removes both `certificates/{'{id}'}` and the student copy).
                    </CardDescription>
                </CardHeader>
                  <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="deleteFromAll">All certificates (recent)</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => loadAllCertificates()}
                        disabled={allCertificatesLoading}
                      >
                        {allCertificatesLoading ? 'Loading...' : allCertificates ? 'Refresh' : 'Load'}
                      </Button>
                    </div>

                    {allCertificatesError ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {allCertificatesError}
                      </div>
                    ) : null}

                    {allCertificates ? (
                      <>
                        <Input
                          id="allCertificatesFilter"
                          placeholder="Filter by ID / student / course..."
                          value={allCertificatesFilter}
                          onChange={(e) => setAllCertificatesFilter(e.target.value)}
                        />
                        <select
                          id="deleteFromAll"
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={deleteCertificateId}
                          onChange={(e) => setDeleteCertificateId(e.target.value)}
                        >
                          <option value="">Select a certificate</option>
                          {(filteredAllCertificates || []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id} — {c.userName || c.userId} — {c.courseTitle || c.courseCode || ''}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            Showing {(filteredAllCertificates || []).length} of {allCertificates.length} loaded.
                          </p>
                          {allCertificatesHasMore ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => loadAllCertificates({ append: true })}
                              disabled={allCertificatesLoading}
                            >
                              Load more
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Click “Load” to fetch the latest issued certificates.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deleteStudentUid">Student UID (load list)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="deleteStudentUid"
                        placeholder="Firebase uid"
                        value={deleteStudentUid}
                        onChange={(e) => setDeleteStudentUid(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!studentUid.trim()}
                        onClick={() => setDeleteStudentUid(studentUid.trim())}
                      >
                        Use
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter a student UID to load their issued certificates, then pick one to delete.
                    </p>
                  </div>

                  {deleteStudentUid.trim() ? (
                    deleteCandidatesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : deleteCandidatesError ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {deleteCandidatesError.message || 'Failed to load certificates for this student.'}
                      </div>
                    ) : deleteCandidates && deleteCandidates.length > 0 ? (
                      <div className="space-y-2">
                        <Label htmlFor="deleteFromList">Choose from list</Label>
                        <select
                          id="deleteFromList"
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={deleteCertificateId}
                          onChange={(e) => setDeleteCertificateId(e.target.value)}
                        >
                          <option value="">Select a certificate</option>
                          {deleteCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id} — {c.courseTitle || c.courseCode || ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No certificates found for this student.</p>
                    )
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="deleteCertificateId">Certificate ID</Label>
                    <Input
                      id="deleteCertificateId"
                        placeholder="e.g., CA-2025-AWSFND-000127"
                        value={deleteCertificateId}
                        onChange={(e) => setDeleteCertificateId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: open the verify page URL and copy the ID from the address bar.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={deleteCertificate}
                      disabled={isDeleting || !deleteCertificateId.trim()}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Certificate'}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

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
