'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/components/i18n/lang';
import { useUser } from '@/firebase';
import { getAuth } from 'firebase/auth';

type Assignment = {
  id: string;
  title: string;
  authors: string;
  status: string;
  language: string;
  createdAt?: any;
};

const copy = {
  en: {
    title: 'Reviewer Dashboard',
    subtitle: 'Assigned papers awaiting your review.',
    empty: 'No assigned papers yet.',
    preview: 'Preview',
    download: 'Download',
    review: 'Write Review',
    recommendation: 'Recommendation',
    commentsToAuthor: 'Comments to author',
    commentsToEditor: 'Comments to editor (optional)',
    submit: 'Submit review',
    close: 'Close',
    loading: 'Loading…',
  },
  ar: {
    title: 'لوحة المحكم',
    subtitle: 'الأبحاث المخصصة لك للمراجعة.',
    empty: 'لا توجد أبحاث مخصصة لك بعد.',
    preview: 'معاينة',
    download: 'تحميل',
    review: 'كتابة تقييم',
    recommendation: 'التوصية',
    commentsToAuthor: 'ملاحظات للمؤلف',
    commentsToEditor: 'ملاحظات للمحرر (اختياري)',
    submit: 'إرسال التقييم',
    close: 'إغلاق',
    loading: 'جارٍ التحميل…',
  },
} as const;

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export default function ReviewerDashboardPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { lang } = useLang();
  const t = copy[lang];

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedAssignments = useMemo(() => {
    const copy = [...assignments];
    copy.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return copy;
  }, [assignments]);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not signed in');
      const resp = await fetch('/api/reviewer/assignments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to load assignments');
      setAssignments(Array.isArray(j?.assignments) ? j.assignments : []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    void fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading]);

  const fetchPdfUrl = async (articleId: string, disposition: 'inline' | 'attachment') => {
    const token = await getAuth().currentUser?.getIdToken();
    const qs = new URLSearchParams({ mode: 'json', disposition }).toString();
    const resp = await fetch(`/api/journal/articles/${articleId}/download?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(j?.error || 'Failed to fetch PDF URL');
    if (!j?.url) throw new Error('Missing PDF URL');
    return j.url as string;
  };

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreview = async (articleId: string, title: string) => {
    setPreviewTitle(title);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewError(null);
    try {
      const url = await fetchPdfUrl(articleId, 'inline');
      setPreviewUrl(url);
    } catch (e: any) {
      setPreviewError(e?.message || String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (articleId: string) => {
    try {
      const url = await fetchPdfUrl(articleId, 'attachment');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to download PDF',
        description: e?.message || String(e),
      });
    }
  };

  // Review dialog
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewArticle, setReviewArticle] = useState<{ id: string; title: string } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT'>('MINOR_REVISION');
  const [commentsToAuthor, setCommentsToAuthor] = useState('');
  const [commentsToEditor, setCommentsToEditor] = useState('');

  const openReview = async (articleId: string, title: string) => {
    setReviewArticle({ id: articleId, title });
    setReviewOpen(true);
    setReviewLoading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not signed in');
      const resp = await fetch(`/api/journal/articles/${articleId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to load review');
      const review = j?.review as any;
      if (review) {
        if (typeof review.recommendation === 'string') setRecommendation(review.recommendation);
        if (typeof review.commentsToAuthor === 'string') setCommentsToAuthor(review.commentsToAuthor);
        if (typeof review.commentsToEditor === 'string') setCommentsToEditor(review.commentsToEditor);
      } else {
        setRecommendation('MINOR_REVISION');
        setCommentsToAuthor('');
        setCommentsToEditor('');
      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to load review',
        description: e?.message || String(e),
      });
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReview = async () => {
    if (!reviewArticle) return;
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Not signed in');
      const resp = await fetch(`/api/journal/articles/${reviewArticle.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recommendation,
          commentsToAuthor,
          commentsToEditor,
        }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Failed to submit review');
      toast({ title: 'Review submitted' });
      setReviewOpen(false);
      setReviewArticle(null);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to submit review',
        description: e?.message || String(e),
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container space-y-8">
          <header className="space-y-1">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </header>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => fetchAssignments()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : sortedAssignments.length === 0 ? (
            <div className="text-center text-muted-foreground">{t.empty}</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {sortedAssignments.map((a) => (
                <Card key={a.id} className="h-full">
                  <CardHeader>
                    <CardTitle className="truncate">{a.title}</CardTitle>
                    <CardDescription className="truncate">{a.authors}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-3 py-1 uppercase">{a.status}</span>
                      <span className="rounded-full bg-muted px-3 py-1 uppercase">{a.language}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => handlePreview(a.id, a.title)}>
                        {t.preview}
                      </Button>
                      <Button variant="outline" onClick={() => handleDownload(a.id)}>
                        {t.download}
                      </Button>
                      <Button onClick={() => void openReview(a.id, a.title)}>{t.review}</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog
          open={previewOpen}
          onOpenChange={(open) => {
            setPreviewOpen(open);
            if (!open) {
              setPreviewUrl(null);
              setPreviewTitle('');
              setPreviewLoading(false);
              setPreviewError(null);
            }
          }}
        >
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>{previewTitle || 'PDF Preview'}</DialogTitle>
              <DialogDescription>Preview the paper here, then download if needed.</DialogDescription>
            </DialogHeader>
            {previewLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t.loading}</div>
            ) : previewError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {previewError}
              </div>
            ) : previewUrl ? (
              <div className="h-[75vh] w-full overflow-hidden rounded-md border bg-background">
                <iframe title="PDF Preview" src={previewUrl} className="h-full w-full" />
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                {t.close}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={reviewOpen}
          onOpenChange={(open) => {
            setReviewOpen(open);
            if (!open) {
              setReviewArticle(null);
              setReviewLoading(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{reviewArticle?.title || 'Review'}</DialogTitle>
              <DialogDescription>Write your review. It is saved under your account.</DialogDescription>
            </DialogHeader>
            {reviewLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t.loading}</div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t.recommendation}</div>
                  <Select value={recommendation} onValueChange={(v) => setRecommendation(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCEPT">Accept</SelectItem>
                      <SelectItem value="MINOR_REVISION">Minor revision</SelectItem>
                      <SelectItem value="MAJOR_REVISION">Major revision</SelectItem>
                      <SelectItem value="REJECT">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">{t.commentsToAuthor}</div>
                  <Textarea
                    value={commentsToAuthor}
                    onChange={(e) => setCommentsToAuthor(e.target.value)}
                    placeholder="Write constructive feedback for the authors…"
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">{t.commentsToEditor}</div>
                  <Textarea
                    value={commentsToEditor}
                    onChange={(e) => setCommentsToEditor(e.target.value)}
                    placeholder="Optional notes only visible to editors…"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">You must be assigned to the paper to submit.</div>
                  <Input value={reviewArticle?.id || ''} readOnly className="text-xs" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewOpen(false)}>
                {t.close}
              </Button>
              <Button onClick={submitReview} disabled={reviewLoading || !reviewArticle}>
                {t.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}

