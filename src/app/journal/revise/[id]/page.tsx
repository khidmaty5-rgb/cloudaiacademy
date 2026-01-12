"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/landing/header";
import Footer from "@/components/landing/footer";
import { useLang } from "@/components/i18n/lang";
import { useDoc, useMemoFirebase, useUser } from "@/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { doc, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";

export default function JournalRevisePage() {
  const { lang, dir } = useLang();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const articleId = String(params?.id || "");
  const { toast } = useToast();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(
    () => doc(firestore, "settings", "ui"),
    [firestore],
  );
  const { data: ui, isLoading: isUiLoading } = useDoc<any>(settingsDocRef);
  const journalEnabled = ui?.showJournalNav !== false;

  useEffect(() => {
    if (isUiLoading) return;
    if (!journalEnabled) router.replace("/");
  }, [isUiLoading, journalEnabled, router]);

  useEffect(() => {
    if (isUiLoading || !journalEnabled) return;
    if (!isUserLoading && !user) router.push("/login");
  }, [isUiLoading, journalEnabled, isUserLoading, user, router]);

  const articleDocRef = useMemoFirebase(
    () => (user && articleId ? doc(firestore, "journalArticles", articleId) : null),
    [firestore, user, articleId],
  );
  const { data: article, isLoading: isArticleLoading, error: articleError } =
    useDoc<any>(articleDocRef);

  const canRevise = useMemo(() => {
    const status = String(article?.status || "");
    return status === "REVISION_REQUIRED_MINOR" || status === "REVISION_REQUIRED_MAJOR";
  }, [article?.status]);

  const manuscriptVersion = useMemo(() => {
    const v = Number(article?.manuscriptVersion);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }, [article?.manuscriptVersion]);

  const t = useMemo(
    () =>
      ({
        en: {
          title: "Submit a Revision",
          desc: "Upload a revised manuscript PDF and (optionally) add a short note to the editor.",
          mustLogin: "Please log in to submit a revision.",
          notOwner: "You do not have permission to revise this article.",
          notRequested: "A revision is not currently requested for this article.",
          pdfLabel: "Revised manuscript PDF (max 20 MB)",
          noteLabel: "Revision note (optional)",
          notePlaceholder: "Briefly describe what changed (e.g., responded to reviewer comments, updated experiments, fixed formatting).",
          submit: "Submit revision",
          submitting: "Submitting…",
          back: "Back to My Submissions",
        },
        ar: {
          title: "إرسال نسخة مُعدّلة",
          desc: "قم برفع ملف PDF للنسخة المُعدّلة ويمكنك إضافة ملاحظة قصيرة للمحرر (اختياري).",
          mustLogin: "يرجى تسجيل الدخول لإرسال نسخة مُعدّلة.",
          notOwner: "ليس لديك صلاحية لتعديل هذه المقالة.",
          notRequested: "لا يوجد طلب تعديل حاليًا لهذه المقالة.",
          pdfLabel: "ملف PDF للنسخة المُعدّلة (الحد الأقصى 20MB)",
          noteLabel: "ملاحظة التعديل (اختياري)",
          notePlaceholder: "اكتب باختصار ما الذي تغيّر.",
          submit: "إرسال النسخة المُعدّلة",
          submitting: "جارٍ الإرسال…",
          back: "العودة إلى مقالاتي",
        },
      } as const)[lang],
    [lang],
  );

  useEffect(() => {
    if (isArticleLoading || !article || !user) return;
    if (article.createdBy && article.createdBy !== user.uid) {
      toast({ variant: "destructive", title: t.notOwner });
      router.replace("/journal/my-submissions");
    }
  }, [isArticleLoading, article, user, router, toast, t.notOwner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: "destructive", title: t.mustLogin });
      router.push("/login");
      return;
    }
    if (!canRevise) {
      toast({ variant: "destructive", title: t.notRequested });
      return;
    }
    if (!pdfFile) {
      toast({ variant: "destructive", title: "Please attach a PDF file." });
      return;
    }

    const maxBytes = 20 * 1024 * 1024;
    if (pdfFile.size > maxBytes) {
      toast({ variant: "destructive", title: "PDF is too large (max 20 MB)." });
      return;
    }
    const isPdf =
      pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ variant: "destructive", title: "File must be a PDF." });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) throw new Error("Unauthorized");

      const nextVersion = manuscriptVersion + 1;
      const safeTs = Date.now();
      const key = `journal/articles/${user.uid}/${articleId}/revisions/v${nextVersion}-${safeTs}.pdf`;

      const presignResp = await fetch("/api/s3/presign-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, contentType: "application/pdf" }),
      });
      const presignJson = await presignResp.json().catch(() => ({}));
      if (!presignResp.ok) {
        throw new Error(presignJson?.error || "Failed to create upload URL");
      }
      const uploadUrl = presignJson?.url as string | undefined;
      if (!uploadUrl) throw new Error("Missing upload URL");

      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: pdfFile,
      });
      if (!putResp.ok) throw new Error(`Upload failed (${putResp.status})`);

      const resp = await fetch(`/api/journal/articles/${articleId}/submit-revision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pdfPath: key, note }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || "Failed to submit revision");

      toast({ title: "Revision submitted." });
      router.push("/journal/my-submissions");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Revision submission failed",
        description: err?.message || String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isUiLoading && !journalEnabled) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-background py-10 md:py-16">
        <div className="container max-w-3xl">
          <section dir={dir} className="space-y-6">
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="px-0 text-muted-foreground hover:text-primary"
                onClick={() => router.push("/journal/my-submissions")}
              >
                {t.back}
              </Button>
              <h1 className="font-headline text-3xl font-bold md:text-4xl">
                {t.title}
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                {t.desc}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{article?.title || (lang === "ar" ? "مقالة" : "Article")}</CardTitle>
                <CardDescription>
                  {isArticleLoading
                    ? lang === "ar"
                      ? "جارٍ التحميل…"
                      : "Loading…"
                    : articleError
                      ? (articleError as any)?.message || "Failed to load article."
                      : `Status: ${String(article?.status || "—")} • Current version: v${manuscriptVersion}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isArticleLoading && article && !canRevise ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {t.notRequested}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-4 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.pdfLabel}</label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      required
                      disabled={isSubmitting || !canRevise}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.noteLabel}</label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t.notePlaceholder}
                      rows={4}
                      disabled={isSubmitting || !canRevise}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !user || !canRevise}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isSubmitting ? t.submitting : t.submit}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

