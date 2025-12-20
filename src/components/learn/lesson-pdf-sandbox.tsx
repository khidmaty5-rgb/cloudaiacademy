'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  courseId: string;
  lessonId: string;
  title?: string;
};

async function fetchLessonPdfUrl(
  courseId: string,
  lessonId: string,
): Promise<string> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Unauthorized');
  const qs = new URLSearchParams({ mode: 'json' }).toString();
  const resp = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/pdf?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(j?.error || 'Failed to fetch PDF URL');
  if (!j?.url) throw new Error('Missing PDF URL');
  return j.url as string;
}

export default function LessonPdfSandbox({ courseId, lessonId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPreview = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    try {
      const url = await fetchLessonPdfUrl(courseId, lessonId);
      setPdfUrl(url);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button className="bg-accent text-accent-foreground" onClick={openPreview}>
        View PDF
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setPdfUrl(null);
            setLoading(false);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{title || 'Lesson PDF'}</DialogTitle>
            <DialogDescription>Preview the PDF here.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <Skeleton className="h-[75vh] w-full" />
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : pdfUrl ? (
            <div className="h-[75vh] w-full overflow-hidden rounded-md border bg-background">
              <iframe title="Lesson PDF preview" src={pdfUrl} className="h-full w-full" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No preview loaded.</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
