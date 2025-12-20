'use client';

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useUser, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, getFirestore, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/components/i18n/lang';
import {
  type JournalArticleStatus,
  createJournalIssue,
  updateJournalArticleStatusAndIssue,
} from '@/lib/journal';
import { format } from 'date-fns';
import { getAuth } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type WithId<T> = T & { id: string };

const statusOptions: JournalArticleStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'PUBLISHED',
];

export default function AdminJournalPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const { isAdmin, isEditor, loading: roleLoading } = useCurrentRole();
  const { toast } = useToast();
  const { lang } = useLang();

  const t = {
    en: {
      pageTitle: 'Journal Editorial Dashboard',
      pageDesc:
        'Review submissions, update statuses, and assign articles to issues.',
      noPermission: 'You do not have permission to view this page.',
      articleTableTitle: 'Submissions',
      issuesTitle: 'Issues',
      issuesDesc: 'Create or update journal issues for grouping articles.',
      issuesLabel: 'Issue label',
      issuesLabelPlaceholder: 'e.g., Volume 1 (2026), Issue 1',
      issuesYear: 'Year (optional)',
      issuesId: 'Issue ID (optional)',
      createIssueButton: 'Save Issue',
      issueSelectLabel: 'Issue',
      issueNone: 'Unassigned',
      status: 'Status',
      language: 'Lang',
      createdAt: 'Submitted',
      actions: 'Actions',
      toastIssueSaved: 'Issue saved.',
      toastIssueError: 'Failed to save issue.',
      toastArticleSaved: 'Article updated.',
      toastArticleError: 'Failed to update article.',
    },
    ar: {
      pageTitle: 'لوحة تحرير المجلة',
      pageDesc:
        'مراجعة الإرسالات، تحديث الحالات، وربط المقالات بالأعداد.',
      noPermission: 'ليس لديك صلاحية لعرض هذه الصفحة.',
      articleTableTitle: 'الإرسالات',
      issuesTitle: 'الأعداد',
      issuesDesc: 'إنشاء أو تحديث أعداد المجلة لربط المقالات بها.',
      issuesLabel: 'اسم العدد',
      issuesLabelPlaceholder: 'مثال: المجلد 1 (2026)، العدد 1',
      issuesYear: 'السنة (اختياري)',
      issuesId: 'معرّف العدد (اختياري)',
      createIssueButton: 'حفظ العدد',
      issueSelectLabel: 'العدد',
      issueNone: 'بدون عدد',
      status: 'الحالة',
      language: 'اللغة',
      createdAt: 'تاريخ الإرسال',
      actions: 'الإجراءات',
      toastIssueSaved: 'تم حفظ العدد.',
      toastIssueError: 'تعذر حفظ العدد.',
      toastArticleSaved: 'تم تحديث المقالة.',
      toastArticleError: 'تعذر تحديث المقالة.',
    },
  }[lang];

  // useCurrentRole handles role detection

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const isLoading = isUserLoading || isProfileLoading || roleLoading;
  const canView = isAdmin === true || isEditor === true;

  const articlesQuery = useMemoFirebase(
    () =>
      canView
        ? query(
            collection(firestore, 'journalArticles'),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [firestore, canView],
  );
  const { data: articles, isLoading: isArticlesLoading } =
    useCollection<WithId<any>>(articlesQuery as any);

  const issuesQuery = useMemoFirebase(
    () => (canView ? collection(firestore, 'journalIssues') : null),
    [firestore, canView],
  );
  const { data: issues, isLoading: isIssuesLoading } =
    useCollection<WithId<any>>(issuesQuery as any);

  const issuesById = useMemo(() => {
    const map = new Map<string, WithId<any>>();
    (issues || []).forEach((i) => map.set(i.id, i));
    return map;
  }, [issues]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | JournalArticleStatus>('ALL');
  const [languageFilter, setLanguageFilter] = useState<'ALL' | 'en' | 'ar' | 'both'>('ALL');
  const [issueFilter, setIssueFilter] = useState<'ALL' | 'UNASSIGNED' | string>('ALL');
  const [search, setSearch] = useState('');

  const [issueForm, setIssueForm] = useState({
    id: '',
    label: '',
    year: '',
  });

  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfDialogArticle, setPdfDialogArticle] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsArticle, setDetailsArticle] = useState<WithId<any> | null>(null);

  const [reviewerEmail, setReviewerEmail] = useState('');
  const [reviewerSaving, setReviewerSaving] = useState(false);

  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[] | null>(null);

  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewArticleId, setPdfPreviewArticleId] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; title: string } | null>(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);

  const filteredArticles = useMemo(() => {
    if (!articles) return [] as WithId<any>[];
    return articles.filter((article) => {
      if (statusFilter !== 'ALL' && article.status !== statusFilter) {
        return false;
      }
      if (
        languageFilter !== 'ALL' &&
        article.language !== languageFilter
      ) {
        return false;
      }
      if (issueFilter === 'UNASSIGNED') {
        if (article.issueId) return false;
      } else if (issueFilter !== 'ALL') {
        if (article.issueId !== issueFilter) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${article.title || ''} ${article.authors || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [articles, statusFilter, languageFilter, issueFilter, search]);

  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createJournalIssue({
        id: issueForm.id.trim() || undefined,
        label: issueForm.label.trim(),
        year: issueForm.year ? Number(issueForm.year) : undefined,
      });
      toast({ title: t.toastIssueSaved });
      setIssueForm({ id: '', label: '', year: '' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t.toastIssueError,
        description: err?.message || String(err),
      });
    }
  };

  const handleArticleChange = async (
    articleId: string,
    newStatus: JournalArticleStatus,
    newIssueId: string | null,
  ) => {
    try {
      await updateJournalArticleStatusAndIssue(articleId, newStatus, newIssueId);
      toast({ title: t.toastArticleSaved });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t.toastArticleError,
        description: err?.message || String(err),
      });
    }
  };

  const fetchPdfUrl = async (
    articleId: string,
    opts?: { disposition?: 'inline' | 'attachment' },
  ): Promise<string> => {
    const token = await getAuth().currentUser?.getIdToken();
    const qs = new URLSearchParams({
      mode: 'json',
      disposition: opts?.disposition === 'attachment' ? 'attachment' : 'inline',
    }).toString();
    const resp = await fetch(`/api/journal/articles/${articleId}/download?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(j?.error || 'Failed to fetch PDF URL');
    }
    if (!j?.url) throw new Error('Missing PDF URL');
    return j.url as string;
  };

  const handleOpenPdf = async (articleId: string) => {
    try {
      const url = await fetchPdfUrl(articleId, { disposition: 'inline' });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to open PDF',
        description: err?.message || String(err),
      });
    }
  };

  const handlePreviewPdf = async (articleId: string, title: string) => {
    setPdfPreviewArticleId(articleId);
    setPdfPreviewTitle(title);
    setPdfPreviewError(null);
    setPdfPreviewUrl(null);
    setPdfPreviewOpen(true);
    setPdfPreviewLoading(true);
    try {
      const url = await fetchPdfUrl(articleId, { disposition: 'inline' });
      setPdfPreviewUrl(url);
    } catch (err: any) {
      setPdfPreviewError(err?.message || String(err));
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleDownloadPdf = async (articleId: string) => {
    try {
      const url = await fetchPdfUrl(articleId, { disposition: 'attachment' });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to download PDF',
        description: err?.message || String(err),
      });
    }
  };

  const openReplacePdfDialog = (articleId: string, title: string) => {
    setPdfDialogArticle({ id: articleId, title });
    setPdfFile(null);
    setPdfDialogOpen(true);
  };

  const openDetailsDialog = (article: WithId<any>) => {
    setDetailsArticle(article);
    setDetailsOpen(true);
    setReviewerEmail('');
    setReviews(null);
    setReviewsError(null);
    setReviewsLoading(false);
  };

  const updateReviewers = async (action: 'add' | 'remove', email: string) => {
    if (!detailsArticle?.id) return;
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) return;

    setReviewerSaving(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const resp = await fetch(`/api/journal/articles/${detailsArticle.id}/reviewers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, email: normalizedEmail }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(j?.error || 'Failed to update reviewers');
      }
      setDetailsArticle((prev: WithId<any> | null) =>
        prev && prev.id === detailsArticle.id
          ? ({ ...prev, reviewerIds: j.reviewerIds, reviewerEmails: j.reviewerEmails } as any)
          : prev,
      );
      if (action === 'add') setReviewerEmail('');
      toast({ title: action === 'add' ? 'Reviewer assigned.' : 'Reviewer removed.' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Reviewer update failed',
        description: err?.message || String(err),
      });
    } finally {
      setReviewerSaving(false);
    }
  };

  const loadReviews = async () => {
    if (!detailsArticle?.id) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const resp = await fetch(`/api/journal/articles/${detailsArticle.id}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to load reviews');
      setReviews(Array.isArray(j?.reviews) ? j.reviews : []);
    } catch (err: any) {
      setReviewsError(err?.message || String(err));
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openDeleteConfirm = (articleId: string, title: string) => {
    setDeleteCandidate({ id: articleId, title });
    setDeleteConfirmOpen(true);
  };

  const handleReplacePdf = async () => {
    if (!pdfDialogArticle || !pdfFile) return;
    setPdfUploading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');

      const presignResp = await fetch(
        `/api/journal/articles/${pdfDialogArticle.id}/presign-replace`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ contentType: 'application/pdf' }),
        },
      );
      const presignJson = await presignResp.json().catch(() => ({}));
      if (!presignResp.ok) {
        throw new Error(presignJson?.error || 'Failed to create upload URL');
      }

      const putResp = await fetch(presignJson.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfFile,
      });
      if (!putResp.ok) {
        throw new Error(`Upload failed (${putResp.status})`);
      }

      toast({ title: 'PDF replaced.' });
      setPdfDialogOpen(false);
      setPdfDialogArticle(null);
      setPdfFile(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to replace PDF',
        description: err?.message || String(err),
      });
    } finally {
      setPdfUploading(false);
    }
  };

  const handleCopyArticleId = async (articleId: string) => {
    try {
      await navigator.clipboard.writeText(articleId);
      toast({ title: 'Copied article ID.' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: err?.message || String(err),
      });
    }
  };

  const handleUnpublish = async (article: WithId<any>) => {
    try {
      await updateJournalArticleStatusAndIssue(
        article.id,
        'ACCEPTED',
        (article as any).issueId ?? null,
      );
      toast({ title: 'Unpublished (set back to ACCEPTED).' });
      setDetailsOpen(false);
      setDetailsArticle(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to unpublish',
        description: err?.message || String(err),
      });
    }
  };

  const handleDeleteArticle = async () => {
    if (!deleteCandidate) return;
    setDeleteDeleting(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const resp = await fetch(`/api/journal/articles/${deleteCandidate.id}/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to delete');
      toast({ title: 'Deleted article.' });
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
      if (detailsArticle?.id === deleteCandidate.id) {
        setDetailsOpen(false);
        setDetailsArticle(null);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete article',
        description: err?.message || String(err),
      });
    } finally {
      setDeleteDeleting(false);
    }
  };

  const handleRefreshPermissions = async () => {
    try {
      await getAuth().currentUser?.getIdToken(true);
      window.location.reload();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to refresh permissions',
        description: err?.message || String(err),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user || !canView) {
    const profileRole = (userProfile as any)?.role as string | undefined;
    const showClaimsHint =
      !!user &&
      (profileRole === 'admin' || profileRole === 'editor') &&
      canView !== true;
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container">
            <p className="text-center text-muted-foreground">{t.noPermission}</p>
            {showClaimsHint && (
              <div className="mx-auto mt-6 max-w-xl space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Your Firestore profile role is set to{' '}
                  <span className="font-semibold">{profileRole}</span>, but your Firebase ID token
                  does not include that role claim yet.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={handleRefreshPermissions}>
                    Refresh permissions
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If this still doesn&apos;t work, log out and sign back in to refresh your token.
                </p>
              </div>
            )}
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
        <div className="container space-y-8">
          <header className="space-y-1">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">
              {t.pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{t.pageDesc}</p>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.issuesTitle}</CardTitle>
                <CardDescription>{t.issuesDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveIssue} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t.issuesLabel}</label>
                    <Input
                      value={issueForm.label}
                      onChange={(e) =>
                        setIssueForm((prev) => ({
                          ...prev,
                          label: e.target.value,
                        }))
                      }
                      placeholder={t.issuesLabelPlaceholder}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t.issuesYear}</label>
                    <Input
                      type="number"
                      value={issueForm.year}
                      onChange={(e) =>
                        setIssueForm((prev) => ({
                          ...prev,
                          year: e.target.value,
                        }))
                      }
                      placeholder="2026"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t.issuesId}</label>
                    <Input
                      value={issueForm.id}
                      onChange={(e) =>
                        setIssueForm((prev) => ({
                          ...prev,
                          id: e.target.value,
                        }))
                      }
                      placeholder="optional-custom-id"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {t.createIssueButton}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.articleTableTitle}</CardTitle>
                <CardDescription>
                  {isArticlesLoading
                    ? 'Loading submissions...'
                    : `${filteredArticles.length} article(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="mb-4 flex flex-wrap gap-3 text-xs">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as any)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={languageFilter}
                    onValueChange={(v) =>
                      setLanguageFilter(v as any)
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All languages</SelectItem>
                      <SelectItem value="en">en</SelectItem>
                      <SelectItem value="ar">ar</SelectItem>
                      <SelectItem value="both">both</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={issueFilter}
                    onValueChange={(v) =>
                      setIssueFilter(v as any)
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder={t.issueSelectLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">
                        All issues
                      </SelectItem>
                      <SelectItem value="UNASSIGNED">
                        {t.issueNone}
                      </SelectItem>
                      {(issues || []).map((issue) => (
                        <SelectItem key={issue.id} value={issue.id}>
                          {issue.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title or author"
                    className="w-full md:w-auto md:flex-1 text-xs"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>{t.language}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.issueSelectLabel}</TableHead>
                      <TableHead>{t.createdAt}</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead>PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isArticlesLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-12" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredArticles && filteredArticles.length > 0 ? (
                      filteredArticles.map((article) => {
                        const createdAt =
                          (article as any).createdAt?.toDate?.() ??
                          (article as any).createdAt;
                        const issue =
                          article.issueId && issuesById.get(article.issueId);
                        const acceptedAt = (article as any).acceptedAt?.toDate?.() ?? (article as any).acceptedAt;
                        const publishedAt = (article as any).publishedAt?.toDate?.() ?? (article as any).publishedAt;
                        return (
                          <TableRow key={article.id}>
                            <TableCell className="max-w-xs">
                              <div className="font-medium truncate">
                                <button
                                  type="button"
                                  onClick={() => openDetailsDialog(article)}
                                  className="truncate text-left hover:underline"
                                >
                                  {article.title}
                                </button>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {article.authors}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs uppercase">
                              {article.language}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={article.status}
                                onValueChange={(value) =>
                                  handleArticleChange(
                                    article.id,
                                    value as JournalArticleStatus,
                                    article.issueId ?? null,
                                  )
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={article.issueId || 'none'}
                                onValueChange={(value) =>
                                  handleArticleChange(
                                    article.id,
                                    article.status,
                                    value === 'none' ? null : value,
                                  )
                                }
                              >
                                <SelectTrigger className="w-[170px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    {t.issueNone}
                                  </SelectItem>
                                  {(issues || []).map((issue) => (
                                    <SelectItem key={issue.id} value={issue.id}>
                                      {issue.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {createdAt
                                ? format(new Date(createdAt), 'PPP')
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {acceptedAt ? format(new Date(acceptedAt), 'PPP') : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {publishedAt ? format(new Date(publishedAt), 'PPP') : '—'}
                            </TableCell>
                            <TableCell className="text-xs">{(article as any).license || '—'}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {Array.isArray((article as any).keywords) && (article as any).keywords.length
                                ? (article as any).keywords.join(', ')
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewPdf(article.id, String(article.title || ''))}
                                >
                                  Preview
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadPdf(article.id)}
                                >
                                  Download
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    openReplacePdfDialog(article.id, String(article.title || ''))
                                  }
                                >
                                  Replace
                                </Button>
                                {article.status === 'PUBLISHED' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUnpublish(article)}
                                  >
                                    Unpublish
                                  </Button>
                                ) : null}
                                {isAdmin ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      openDeleteConfirm(article.id, String(article.title || ''))
                                    }
                                  >
                                    {lang === 'ar' ? 'حذف' : 'Delete'}
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm">
                          No submissions yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <Dialog
                  open={pdfDialogOpen}
                  onOpenChange={(open) => {
                    setPdfDialogOpen(open);
                    if (!open) {
                      setPdfDialogArticle(null);
                      setPdfFile(null);
                      setPdfUploading(false);
                    }
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Replace PDF</DialogTitle>
                      <DialogDescription>
                        Upload a new PDF to replace the current manuscript.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {pdfDialogArticle ? pdfDialogArticle.title : ''}
                      </div>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        PDF only. Max 20 MB (client-side).
                      </p>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setPdfDialogOpen(false)}
                        disabled={pdfUploading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleReplacePdf}
                        disabled={!pdfDialogArticle || !pdfFile || pdfUploading}
                      >
                        {pdfUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                  <Dialog
                  open={detailsOpen}
                  onOpenChange={(open) => {
                    setDetailsOpen(open);
                    if (!open) {
                      setDetailsArticle(null);
                      setReviewerEmail('');
                      setReviews(null);
                      setReviewsError(null);
                      setReviewsLoading(false);
                    }
                  }}
                >
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {lang === 'ar' ? 'تفاصيل الإرسال' : 'Submission details'}
                      </DialogTitle>
                      <DialogDescription>
                        {lang === 'ar'
                          ? 'عرض بيانات المقال وإجراءات ملف PDF.'
                          : 'View article metadata and PDF actions.'}
                      </DialogDescription>
                    </DialogHeader>

                    {detailsArticle ? (
                      <div className="space-y-5">
                        <div className="text-xs text-muted-foreground">
                          {lang === 'ar' ? 'المعرّف:' : 'ID:'} {detailsArticle.id}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          <div>
                            <span className="font-medium">{t.status}:</span>{' '}
                            {(detailsArticle as any).status || '—'}
                          </div>
                          <div>
                            <span className="font-medium">{t.issueSelectLabel}:</span>{' '}
                            {(detailsArticle as any).issueId
                              ? (issuesById.get((detailsArticle as any).issueId)?.label ||
                                  (detailsArticle as any).issueId)
                              : t.issueNone}
                          </div>
                          <div>
                            <span className="font-medium">{t.language}:</span>{' '}
                            {(detailsArticle as any).language || '—'}
                          </div>
                          <div>
                            <span className="font-medium">License:</span>{' '}
                            {(detailsArticle as any).license || '—'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {lang === 'ar' ? 'العنوان' : 'Title'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(detailsArticle as any).title || '—'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {lang === 'ar' ? 'المؤلفون' : 'Authors'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(detailsArticle as any).authors || '—'}
                          </div>
                        </div>

                        {Array.isArray((detailsArticle as any).affiliations) &&
                        (detailsArticle as any).affiliations.length ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {lang === 'ar' ? 'الجهات/الانتماءات' : 'Affiliations'}
                            </div>
                            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                              {(detailsArticle as any).affiliations.map((a: string, i: number) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="font-medium">
                              {lang === 'ar' ? 'المُرسِل' : 'Submitter'}:
                            </span>{' '}
                            {(detailsArticle as any).createdByName ||
                              (detailsArticle as any).createdBy ||
                              '—'}
                          </div>
                          <div>
                            <span className="font-medium">
                              {lang === 'ar' ? 'البريد' : 'Email'}:
                            </span>{' '}
                            {(detailsArticle as any).createdByEmail ? (
                              <a
                                className="text-accent underline-offset-4 hover:underline"
                                href={`mailto:${(detailsArticle as any).createdByEmail}`}
                              >
                                {(detailsArticle as any).createdByEmail}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-medium">Code/Data:</span>{' '}
                            {(detailsArticle as any).codeUrl ? (
                              <a
                                className="text-accent underline-offset-4 hover:underline break-all"
                                href={(detailsArticle as any).codeUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                              >
                                {(detailsArticle as any).codeUrl}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>

                        {Array.isArray((detailsArticle as any).keywords) &&
                        (detailsArticle as any).keywords.length ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">Keywords</div>
                            <div className="text-sm text-muted-foreground">
                              {(detailsArticle as any).keywords.join(', ')}
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <div className="text-sm font-medium">
                            {lang === 'ar' ? 'المحكّمون' : 'Reviewers'}
                          </div>
                          {Array.isArray((detailsArticle as any).reviewerEmails) &&
                          (detailsArticle as any).reviewerEmails.filter(Boolean).length ? (
                            <div className="flex flex-wrap gap-2">
                              {(detailsArticle as any).reviewerEmails
                                .filter(Boolean)
                                .map((em: string) => (
                                  <div
                                    key={em}
                                    className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
                                  >
                                    <span className="max-w-[220px] truncate">{em}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void updateReviewers('remove', em)}
                                      disabled={reviewerSaving}
                                    >
                                      {lang === 'ar' ? 'إزالة' : 'Remove'}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {lang === 'ar' ? 'لا يوجد محكّمون بعد.' : 'No reviewers assigned yet.'}
                            </div>
                          )}

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              type="email"
                              value={reviewerEmail}
                              onChange={(e) => setReviewerEmail(e.target.value)}
                              placeholder="reviewer@example.com"
                            />
                            <Button
                              onClick={() => void updateReviewers('add', reviewerEmail)}
                              disabled={reviewerSaving || !reviewerEmail.trim()}
                            >
                              {reviewerSaving
                                ? lang === 'ar'
                                  ? 'جارٍ الحفظ…'
                                  : 'Saving…'
                                : lang === 'ar'
                                  ? 'إضافة محكّم'
                                  : 'Add reviewer'}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {lang === 'ar'
                              ? 'يجب أن يمتلك المحكّم حسابًا ويمكنه مراجعة الأبحاث من صفحة /reviewer.'
                              : 'Reviewer must have an account and can access assigned papers at /reviewer.'}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                              {lang === 'ar' ? 'التقييمات' : 'Reviews'}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void loadReviews()}
                              disabled={reviewsLoading || !detailsArticle}
                            >
                              {reviewsLoading
                                ? lang === 'ar'
                                  ? 'جارٍ التحميل…'
                                  : 'Loading…'
                                : lang === 'ar'
                                  ? 'تحميل التقييمات'
                                  : 'Load reviews'}
                            </Button>
                          </div>

                          {reviewsError ? (
                            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                              {reviewsError}
                            </div>
                          ) : reviewsLoading ? (
                            <div className="text-sm text-muted-foreground">
                              {lang === 'ar' ? 'جارٍ جلب التقييمات…' : 'Fetching reviews…'}
                            </div>
                          ) : reviews == null ? (
                            <div className="text-sm text-muted-foreground">
                              {lang === 'ar'
                                ? 'اضغط "تحميل التقييمات" لعرض ملاحظات المحكّمين.'
                                : 'Click “Load reviews” to see reviewer feedback.'}
                            </div>
                          ) : reviews.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              {lang === 'ar' ? 'لم يتم إرسال أي تقييم بعد.' : 'No reviews submitted yet.'}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {reviews.map((r: any) => {
                                const submitted =
                                  r?.submittedAt?.toDate?.() ?? r?.submittedAt ?? null;
                                return (
                                  <div
                                    key={r.id}
                                    className="rounded-md border border-border bg-background p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-xs text-muted-foreground break-all">
                                        {r?.reviewerEmail || r?.reviewerId || '—'}
                                      </div>
                                      <div className="text-xs font-semibold uppercase">
                                        {r?.recommendation || '—'}
                                      </div>
                                    </div>
                                    {submitted ? (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {format(new Date(submitted), 'PPP')}
                                      </div>
                                    ) : null}
                                    <div className="mt-3 space-y-1">
                                      <div className="text-xs font-medium">
                                        {lang === 'ar' ? 'ملاحظات للمؤلف' : 'To author'}
                                      </div>
                                      <div className="whitespace-pre-line text-sm text-muted-foreground">
                                        {r?.commentsToAuthor || '—'}
                                      </div>
                                    </div>
                                    {r?.commentsToEditor ? (
                                      <div className="mt-3 space-y-1">
                                        <div className="text-xs font-medium">
                                          {lang === 'ar' ? 'ملاحظات للمحرر' : 'To editor'}
                                        </div>
                                        <div className="whitespace-pre-line text-sm text-muted-foreground">
                                          {r?.commentsToEditor}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {lang === 'ar' ? 'الملخص' : 'Abstract'}
                          </div>
                          <p className="text-sm whitespace-pre-line text-foreground">
                            {(detailsArticle as any).abstract || '—'}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <DialogFooter>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => detailsArticle && handleCopyArticleId(detailsArticle.id)}
                          disabled={!detailsArticle}
                        >
                          {lang === 'ar' ? 'نسخ المعرّف' : 'Copy ID'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            detailsArticle &&
                            handlePreviewPdf(detailsArticle.id, String((detailsArticle as any).title || ''))
                          }
                          disabled={!detailsArticle}
                        >
                          {lang === 'ar' ? 'معاينة PDF' : 'Preview PDF'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => detailsArticle && handleDownloadPdf(detailsArticle.id)}
                          disabled={!detailsArticle}
                        >
                          {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                        </Button>
                        <Button
                          onClick={() => {
                            if (!detailsArticle) return;
                            setDetailsOpen(false);
                            openReplacePdfDialog(detailsArticle.id, String((detailsArticle as any).title || ''));
                          }}
                          disabled={!detailsArticle}
                        >
                          {lang === 'ar' ? 'استبدال PDF' : 'Replace PDF'}
                        </Button>
                        {detailsArticle && (detailsArticle as any).status === 'PUBLISHED' ? (
                          <Button
                            variant="outline"
                            onClick={() => handleUnpublish(detailsArticle)}
                          >
                            {lang === 'ar' ? 'إلغاء النشر' : 'Unpublish'}
                          </Button>
                        ) : null}
                        {detailsArticle && isAdmin ? (
                          <Button
                            variant="destructive"
                            onClick={() =>
                              openDeleteConfirm(detailsArticle.id, String((detailsArticle as any).title || ''))
                            }
                          >
                            {lang === 'ar' ? 'حذف' : 'Delete'}
                          </Button>
                        ) : null}
                        <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                          {lang === 'ar' ? 'إغلاق' : 'Close'}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog
                  open={pdfPreviewOpen}
                  onOpenChange={(open) => {
                    setPdfPreviewOpen(open);
                    if (!open) {
                      setPdfPreviewUrl(null);
                      setPdfPreviewArticleId(null);
                      setPdfPreviewTitle('');
                      setPdfPreviewLoading(false);
                      setPdfPreviewError(null);
                    }
                  }}
                >
                  <DialogContent className="max-w-5xl">
                    <DialogHeader>
                      <DialogTitle>{pdfPreviewTitle || 'PDF Preview'}</DialogTitle>
                      <DialogDescription>
                        {lang === 'ar'
                          ? 'معاينة الملف قبل التحميل.'
                          : 'Preview the paper before downloading.'}
                      </DialogDescription>
                    </DialogHeader>

                    {pdfPreviewLoading ? (
                      <div className="text-sm text-muted-foreground">Loading PDF…</div>
                    ) : pdfPreviewError ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {pdfPreviewError}
                      </div>
                    ) : pdfPreviewUrl ? (
                      <div className="h-[70vh] w-full overflow-hidden rounded-md border">
                        <iframe
                          title="PDF Preview"
                          src={pdfPreviewUrl}
                          className="h-full w-full"
                        />
                      </div>
                    ) : null}

                    <DialogFooter>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => pdfPreviewUrl && window.open(pdfPreviewUrl, '_blank', 'noopener,noreferrer')}
                          disabled={!pdfPreviewUrl}
                        >
                          {lang === 'ar' ? 'فتح في تبويب' : 'Open in tab'}
                        </Button>
                        <Button
                          onClick={() => pdfPreviewArticleId && handleDownloadPdf(pdfPreviewArticleId)}
                          disabled={!pdfPreviewArticleId}
                        >
                          {lang === 'ar' ? 'تحميل' : 'Download'}
                        </Button>
                        <Button variant="outline" onClick={() => setPdfPreviewOpen(false)}>
                          {lang === 'ar' ? 'إغلاق' : 'Close'}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm deletion'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {deleteCandidate
                          ? (lang === 'ar'
                              ? `سيتم حذف المقال نهائياً وملف PDF المرتبط به: ${deleteCandidate.title}`
                              : `This will permanently delete the article and its PDF: ${deleteCandidate.title}`)
                          : null}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteDeleting}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleDeleteArticle();
                        }}
                        disabled={!deleteCandidate || deleteDeleting}
                      >
                        {deleteDeleting ? (lang === 'ar' ? 'جارٍ الحذف…' : 'Deleting…') : (lang === 'ar' ? 'حذف' : 'Delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
