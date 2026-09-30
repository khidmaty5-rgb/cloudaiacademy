"use client";

import { useLang } from "@/components/i18n/lang";
import { useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  doc,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { WithId } from "@/firebase/firestore/use-collection";
import type { JournalArticleStatus } from "@/lib/journal";
import { getAuth } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

type Article = WithId<{
  title: string;
  status: JournalArticleStatus;
  createdAt?: any;
  issueId?: string | null;
  license?: string;
  acceptedAt?: any;
  publishedAt?: any;
  manuscriptVersion?: number;
}>;

function toDateValue(v: any): Date | null {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function JournalMySubmissionsPage() {
  const { lang, dir } = useLang();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = getFirestore();
  const { toast } = useToast();

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

  const t = {
    en: {
      pageTitle: "My Journal Submissions",
      pageSubtitle:
        "Track the status of articles you have submitted to the CloudAI Journal.",
      title: "Title",
      pdf: "PDF",
      status: "Status",
      submittedAt: "Submitted",
      acceptedAt: "Accepted",
      publishedAt: "Published",
      license: "License",
      issue: "Issue",
      issueUnassigned: "Not yet assigned",
      empty: "You have not submitted any articles yet.",
      loading: "Loading your submissions...",
      open: "Open PDF",
      uploadRevision: "Upload revision",
    },
    ar: {
      pageTitle: "مقالاتي المرسلة إلى المجلة",
      pageSubtitle:
        "تابِع حالة الأبحاث والمقالات التي قمت بإرسالها إلى مجلة CloudAI.",
      title: "العنوان",
      pdf: "ملف PDF",
      status: "الحالة",
      submittedAt: "تاريخ الإرسال",
      acceptedAt: "تاريخ القبول",
      publishedAt: "تاريخ النشر",
      license: "الترخيص",
      issue: "العدد",
      issueUnassigned: "لم يُحدَّد عدد بعد",
      empty: "لم تقم بإرسال أي مقالات بعد.",
      loading: "جارٍ تحميل مقالاتك...",
      open: "فتح PDF",
      uploadRevision: "رفع نسخة منقحة",
    },
  }[lang];

  useEffect(() => {
    if (isUiLoading || !journalEnabled) return;
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [isUiLoading, journalEnabled, user, isUserLoading, router]);

  const submissionsQuery = useMemoFirebase(
    () =>
      user && journalEnabled
        ? query(
            collection(firestore, "journalArticles"),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc"),
          )
        : null,
    [firestore, user, journalEnabled],
  );

  const { data: submissions, isLoading } =
    useCollection<Article>(submissionsQuery as any);

  const hasSubmissions = (submissions?.length ?? 0) > 0;

  const formattedSubmissions = useMemo(
    () =>
      (submissions ?? []).map((a) => ({
        ...a,
        createdAtDate: toDateValue(a.createdAt),
      })),
    [submissions],
  );

  const handleOpenPdf = async (articleId: string) => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Unauthorized");

      const resp = await fetch(`/api/journal/articles/${articleId}/download?mode=json`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(j?.error || "Failed to get PDF URL");
      }
      if (!j?.url) throw new Error("Missing PDF URL");
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to open PDF",
        description: err?.message || String(err),
      });
    }
  };

  if (!isUiLoading && !journalEnabled) return null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background">
      <main className="flex-1 bg-background py-10 md:py-16">
        <div className="container max-w-5xl">
          <section dir={dir} className="space-y-6">
            <header className="mb-4 space-y-2">
              <h1 className="font-headline text-3xl font-bold md:text-4xl">
                {t.pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                {t.pageSubtitle}
              </p>
            </header>

            <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">
                  {isLoading ? t.loading : null}
                </p>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {isLoading &&
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-36 w-full rounded-lg" />
                  ))}
                {!isLoading && !hasSubmissions && (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>
                )}
                {!isLoading &&
                  formattedSubmissions.map((article) => (
                    <article key={article.id} className="space-y-4 rounded-lg border bg-background p-4">
                      <div className="space-y-1">
                        <h2 className="font-semibold leading-snug">{article.title}</h2>
                        <p className="text-xs text-muted-foreground">{article.status}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">{t.issue}</dt>
                          <dd>{article.issueId || t.issueUnassigned}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t.submittedAt}</dt>
                          <dd>{article.createdAtDate?.toLocaleDateString() || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t.publishedAt}</dt>
                          <dd>{toDateValue((article as any).publishedAt)?.toLocaleDateString?.() || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t.license}</dt>
                          <dd>{(article as any).license || "—"}</dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleOpenPdf(article.id)}>
                          {t.open}
                        </Button>
                        {(article.status === "REVISION_REQUIRED_MINOR" ||
                          article.status === "REVISION_REQUIRED_MAJOR") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => router.push(`/journal/revise/${article.id}`)}
                          >
                            {t.uploadRevision}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.title}</TableHead>
                      <TableHead>{t.pdf}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.issue}</TableHead>
                      <TableHead>{t.submittedAt}</TableHead>
                      <TableHead>{t.acceptedAt}</TableHead>
                      <TableHead>{t.publishedAt}</TableHead>
                      <TableHead>{t.license}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-48" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                    {!isLoading && !hasSubmissions && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          {t.empty}
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading &&
                      formattedSubmissions.map((article) => (
                        <TableRow key={article.id}>
                          <TableCell className="font-medium">
                            {article.title}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPdf(article.id)}
                              >
                                {t.open}
                              </Button>
                              {(article.status === "REVISION_REQUIRED_MINOR" ||
                                article.status === "REVISION_REQUIRED_MAJOR") && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    router.push(`/journal/revise/${article.id}`)
                                  }
                                >
                                  {t.uploadRevision}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{article.status}</TableCell>
                          <TableCell>
                            {article.issueId
                              ? article.issueId
                              : t.issueUnassigned}
                          </TableCell>
                          <TableCell>
                            {article.createdAtDate
                              ? article.createdAtDate.toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {toDateValue((article as any).acceptedAt)?.toLocaleDateString?.() || "—"}
                          </TableCell>
                          <TableCell>
                            {toDateValue((article as any).publishedAt)?.toLocaleDateString?.() || "—"}
                          </TableCell>
                          <TableCell>
                            {(article as any).license || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
