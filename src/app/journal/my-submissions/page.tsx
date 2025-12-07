"use client";

import Header from "@/components/landing/header";
import Footer from "@/components/landing/footer";
import { useLang } from "@/components/i18n/lang";
import { useUser, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
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
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { WithId } from "@/firebase/firestore/use-collection";
import type { JournalArticleStatus } from "@/lib/journal";

type Article = WithId<{
  title: string;
  status: JournalArticleStatus;
  createdAt?: any;
  issueId?: string | null;
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

  const t = {
    en: {
      pageTitle: "My Journal Submissions",
      pageSubtitle:
        "Track the status of articles you have submitted to the CloudAI Journal.",
      title: "Title",
      status: "Status",
      submittedAt: "Submitted",
      issue: "Issue",
      issueUnassigned: "Not yet assigned",
      empty: "You have not submitted any articles yet.",
      loading: "Loading your submissions...",
    },
    ar: {
      pageTitle: "مقالاتي المرسلة إلى المجلة",
      pageSubtitle:
        "تابِع حالة الأبحاث والمقالات التي قمت بإرسالها إلى مجلة CloudAI.",
      title: "العنوان",
      status: "الحالة",
      submittedAt: "تاريخ الإرسال",
      issue: "العدد",
      issueUnassigned: "لم يُحدَّد عدد بعد",
      empty: "لم تقم بإرسال أي مقالات بعد.",
      loading: "جارٍ تحميل مقالاتك...",
    },
  }[lang];

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login");
    }
  }, [user, isUserLoading, router]);

  const submissionsQuery = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, "journalArticles"),
            where("createdBy", "==", user.uid),
            orderBy("createdAt", "desc"),
          )
        : null,
    [firestore, user],
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.title}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.issue}</TableHead>
                      <TableHead>{t.submittedAt}</TableHead>
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
                          colSpan={4}
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
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

