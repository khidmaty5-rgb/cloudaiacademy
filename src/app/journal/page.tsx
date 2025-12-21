"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/i18n/lang";
import Header from "@/components/landing/header";
import Footer from "@/components/landing/footer";
import { useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  collection,
  doc,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type { JournalArticle, JournalIssue } from "@/types/models";

const content = {
  en: {
    dir: "ltr" as const,
    name: "CloudAI Journal of Applied AI & Data",
    badge: "Official journal of CloudAI Academy & Research Lab",
    intro:
      "CloudAI Journal of Applied AI & Data is an open‑access, peer‑reviewed venue of CloudAI Academy & Research Lab (cloudaiacademy.ca). We publish applied, reproducible work at the intersection of AI, data, cloud, and real‑world impact, with a special focus on Libya and emerging markets.",
    aimsTitle: "Aims & Scope",
    aims: [
      "Applied machine learning, MLOps, and data engineering.",
      "Cloud, edge, and IoT architectures for real‑world systems.",
      "Knowledge graphs, information retrieval, and intelligent services.",
      "AI for marketplaces, public services, finance, health, and local ecosystems.",
      "Sustainability, carbon analytics, and smart infrastructure.",
      "AI education, capacity building, and inclusive digital skills.",
    ],
    typesTitle: "What We Publish",
    types: [
      "Short research articles (4–10 pages).",
      "Technical reports and system architecture papers.",
      "Case studies from industry, startups, public sector, and NGOs.",
      "Datasets, benchmarks, and reproducible notebooks.",
      "Education & pedagogy pieces on teaching AI, cloud, and data.",
    ],
    oaTitle: "Open Access & Ethics",
    oaBody:
      "The journal is diamond open access: no fees to read, no fees to publish. Authors retain copyright and grant CloudAI Journal the right to host and index their work. All submissions are screened for originality, research integrity, and responsible use of AI tools.",
    reviewTitle: "Peer Review & Process",
    reviewSteps: [
      "Initial check for scope, clarity, and originality.",
      "Single‑blind or open review by at least one reviewer (aiming for two when possible).",
      "Constructive feedback with a clear accept / revise / reject decision.",
      "Accepted articles are published online on a rolling basis and grouped into issues.",
    ],
    submitTitle: "How to Submit",
    submitBody:
      "We are now inviting submissions for Volume 1. Prepare your manuscript using your preferred LaTeX or Word template and send it as a PDF (with any source files or code links) to:",
    email: "journal@cloudaiacademy.ca",
    submitList: [
      "Language: English, Arabic, or bilingual.",
      "Include title, authors, affiliations, abstract, and keywords.",
      "Clearly state contributions, methods, datasets, and limitations.",
      "Disclose any use of AI tools in writing or experiments.",
      "If code/data are available, include links (GitHub, etc.).",
    ],
    boardTitle: "Editorial Board",
    board: [
      "Editor‑in‑Chief: Fateh Adhnouss, CloudAI Academy & Research Lab.",
      "Advisory Editors: To be announced – we welcome collaborators from academia and industry.",
    ],
    issuesTitle: "Issues & Articles",
    issuesBody:
      "Volume 1 will feature technical reports and applied AI studies originating from CloudAI Academy projects and partner organizations. Early accepted articles will appear here once published.",
    issuesGroupUnassigned: "Early access (no issue assigned)",
    issuesLoading: "Loading published articles...",
    issuesEmpty: "No published articles yet.",
    ctaPrimary: "Contact the Editor‑in‑Chief",
    ctaSecondary: "Author Guidelines",
  },
  ar: {
    dir: "rtl" as const,
    name: "مجلة CloudAI للأبحاث التطبيقية والبيانات",
    badge: "المجلة الرسمية لـ CloudAI Academy & Research Lab",
    intro:
      "مجلة CloudAI للأبحاث التطبيقية والبيانات هي مجلة علمية مفتوحة الوصول ومحكَّمة تصدر عن CloudAI Academy & Research Lab. نركّز على الأبحاث التطبيقية والقابلة لإعادة الإنتاج في تقاطع الذكاء الاصطناعي، والبيانات، والحوسبة السحابية، مع اهتمام خاص بليبيا والأسواق الناشئة.",
    aimsTitle: "الأهداف والنطاق",
    aims: [
      "تطبيقات التعلّم الآلي، وعمليات نماذج التعلّم الآلي (MLOps)، وهندسة البيانات.",
      "هندسة حلول السحابة، والحافة (Edge)، وإنترنت الأشياء للأنظمة الواقعية.",
      "الخدمات الذكية، واسترجاع المعلومات، والبحث الدلالي.",
      "الذكاء الاصطناعي في الأسواق الرقمية، والخدمات الحكومية، والقطاع الصحي والمالي.",
      "الاستدامة، وتحليل الانبعاثات الكربونية، والبنية التحتية الذكية.",
      "تعليم الذكاء الاصطناعي وبناء القدرات الرقمية الشاملة.",
    ],
    typesTitle: "أنواع الأبحاث المنشورة",
    types: [
      "أبحاث علمية قصيرة (٤–١٠ صفحات).",
      "تقارير تقنية ووثائق تصميم الأنظمة والمنصات.",
      "دراسات حالة من الشركات الناشئة والقطاعين العام والخاص.",
      "مجموعات بيانات، ومعايير تجريبية (Benchmarks)، ودفاتر تفاعلية قابلة للتكرار.",
      "مقالات تربوية حول تدريس الذكاء الاصطناعي والحوسبة السحابية والبيانات.",
    ],
    oaTitle: "الوصول المفتوح والأخلاقيات",
    oaBody:
      "المجلة تعمل بنظام الوصول المفتوح بالكامل (Diamond Open Access): لا توجد رسوم على القراءة أو النشر. يحتفظ المؤلفون بحقوقهم مع السماح للمجلة بأرشفة الأبحاث وفهرستها. تُراجع جميع الأعمال من حيث الأصالة، ونزاهة البحث، والاستخدام المسؤول لأدوات الذكاء الاصطناعي.",
    reviewTitle: "آلية التحكيم",
    reviewSteps: [
      "مراجعة أولية للتأكد من ملاءمة الموضوع ووضوحه والتزامه بمعايير المجلة.",
      "تحكيم علمي (مجهول أو مفتوح) من قبل محكم واحد على الأقل (نسعى لاثنين متى أمكن).",
      "تقديم ملاحظات بنّاءة مع قرار واضح: قبول، أو تعديل، أو رفض.",
      "نشر الأبحاث المقبولة إلكترونياً بشكل مستمر وتجميعها في أعداد دورية.",
    ],
    submitTitle: "طريقة الإرسال",
    submitBody:
      "ندعوكم لإرسال أبحاثكم للمجلد الأول. يُرجى إعداد البحث باللغة المناسبة وإرساله كملف PDF (مع أي روابط للبيانات أو الشيفرة البرمجية إن وجدت) إلى:",
    email: "journal@cloudaiacademy.ca",
    submitList: [
      "لغة البحث: العربية أو الإنجليزية (أو نسخة ثنائية اللغة).",
      "إدراج العنوان، وأسماء المؤلفين، والجهات التابعة، والملخّص، والكلمات المفتاحية.",
      "توضيح منهجية العمل، والبيانات المستخدمة، وأهم النتائج والقيود.",
      "ذكر أي استخدام لأدوات الذكاء الاصطناعي أثناء كتابة البحث أو إجراء التجارب.",
      "إضافة روابط لشفرة المصدر أو البيانات (GitHub وغيرها) إن توفرت.",
    ],
    boardTitle: "الهيئة التحريرية",
    board: [
      "رئيس التحرير: فتحي أدهنوس، CloudAI Academy & Research Lab.",
      "أعضاء هيئة التحرير والاستشاريون: سيتم الإعلان عنهم، ونتطلع للتعاون مع شركاء من الجامعات والصناعة.",
    ],
    issuesTitle: "الأعداد والمقالات المنشورة",
    issuesBody:
      "سيضم المجلد الأول تقارير تقنية وأبحاثاً تطبيقية في الذكاء الاصطناعي من مشاريع CloudAI وشركائها. ستُعرض هنا المقالات التي تم قبولها ونشرها.",
    issuesGroupUnassigned: "مقالات مبكرة بدون عدد محدّد",
    issuesLoading: "جارٍ تحميل المقالات المنشورة...",
    issuesEmpty: "لا توجد مقالات منشورة حتى الآن.",
    ctaPrimary: "مراسلة رئيس التحرير",
    ctaSecondary: "تحميل إرشادات النشر (PDF)",
  },
};

export default function JournalPage() {
  const { lang, dir } = useLang();
  const t = content[lang];
  const isArabic = lang === "ar";
  const { user } = useUser();
  const { isAdmin, isEditor } = useCurrentRole();
  const guidelinesUrl =
    process.env.NEXT_PUBLIC_JOURNAL_GUIDELINES_URL ||
    "/journal/guidelines";

  const bodyTextClass = isArabic
    ? "text-base leading-relaxed"
    : "text-sm leading-relaxed";
  const listTextClass = isArabic ? "text-[15px] leading-relaxed" : "text-sm";

  const firestore = getFirestore();
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, "users", user.uid) : null),
    [firestore, user],
  );
  const { data: userProfile } = useDoc(userDocRef);
  const canAccessJournalDashboard =
    isAdmin ||
    isEditor ||
    (userProfile?.role === "admin" || userProfile?.role === "editor");

  const [forcePublishedFallback, setForcePublishedFallback] = useState(false);

  function toMillis(v: any): number {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.toDate === "function") return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  }

  // Published articles (public)
  const publishedArticlesPrimaryQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, "journalArticles"),
        where("status", "==", "PUBLISHED"),
        orderBy("createdAt", "desc"),
      ),
    [firestore],
  );
  const publishedArticlesFallbackQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, "journalArticles"),
        where("status", "==", "PUBLISHED"),
      ),
    [firestore],
  );

  const {
    data: publishedArticlesPrimary,
    isLoading: isArticlesLoadingPrimary,
    error: publishedArticlesErrorPrimary,
  } = useCollection<JournalArticle>(
    forcePublishedFallback ? null : (publishedArticlesPrimaryQuery as any),
  );

  useEffect(() => {
    const code = (publishedArticlesErrorPrimary as any)?.code as string | undefined;
    if (code === "failed-precondition") {
      setForcePublishedFallback(true);
    }
  }, [publishedArticlesErrorPrimary]);

  const {
    data: publishedArticlesFallback,
    isLoading: isArticlesLoadingFallback,
    error: publishedArticlesErrorFallback,
  } = useCollection<JournalArticle>(
    forcePublishedFallback ? (publishedArticlesFallbackQuery as any) : null,
  );

  const publishedArticles = forcePublishedFallback
    ? publishedArticlesFallback
    : publishedArticlesPrimary;
  const isArticlesLoading = forcePublishedFallback
    ? isArticlesLoadingFallback
    : isArticlesLoadingPrimary;
  const publishedArticlesError = forcePublishedFallback
    ? publishedArticlesErrorFallback
    : publishedArticlesErrorPrimary;

  // Issues for grouping
  const issuesQuery = useMemoFirebase(
    () => collection(firestore, "journalIssues"),
    [firestore],
  );
  const { data: issues } = useCollection<JournalIssue>(issuesQuery as any);

  const sortedPublishedArticles = useMemo(() => {
    if (!publishedArticles || publishedArticles.length === 0) return [];
    const copy = [...publishedArticles] as any[];
    copy.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return copy;
  }, [publishedArticles]);

  const groupedArticles = useMemo(() => {
    if (!sortedPublishedArticles || sortedPublishedArticles.length === 0) return [];
    const issueMap = new Map<string, JournalIssue>();
    (issues || []).forEach((issue) => {
      issueMap.set(issue.id, issue);
    });

    const groups: { key: string; label: string; items: JournalArticle[] }[] = [];
    const byKey = new Map<string, { key: string; label: string; items: JournalArticle[] }>();

    sortedPublishedArticles.forEach((article: any) => {
      const rawIssueId = article.issueId || "__unassigned__";
      const issue = rawIssueId === "__unassigned__" ? null : issueMap.get(rawIssueId);
      const label = issue
        ? issue.label
        : t.issuesGroupUnassigned;

      let group = byKey.get(rawIssueId);
      if (!group) {
        group = { key: rawIssueId, label, items: [] };
        byKey.set(rawIssueId, group);
        groups.push(group);
      }
      group.items.push(article);
    });

    return groups;
  }, [sortedPublishedArticles, issues, t.issuesGroupUnassigned]);

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <Header />
      <main className="flex-1 bg-muted text-foreground">
        <section
          dir={dir}
          className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10"
        >
          {/* Header */}
          <header className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {t.badge}
            </span>
            <h1
              className={`font-semibold tracking-tight ${
                isArabic ? "text-4xl" : "text-3xl"
              }`}
            >
              {t.name}
            </h1>
            <p className={`max-w-3xl text-foreground ${bodyTextClass}`}>
              {t.intro}
            </p>
            {user && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="sm"
                  className="bg-accent text-accent-foreground"
                >
                  <Link href="/journal/submit">
                    {lang === "ar" ? "إرسال مقالة للمجلة" : "Submit an Article"}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-accent text-accent bg-background hover:bg-accent/10"
                >
                  <Link href="/journal/my-submissions">
                    {lang === "ar" ? "مقالاتي المرسلة" : "My Submissions"}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-accent text-accent bg-background hover:bg-accent/10"
                >
                  <Link
                    href={guidelinesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {lang === "ar" ? "دليل المؤلف (PDF)" : "Author Guidelines (PDF)"}
                  </Link>
                </Button>
                {canAccessJournalDashboard && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-accent text-accent bg-background hover:bg-accent/10"
                  >
                    <Link href="/admin/journal">
                      {lang === "ar" ? "لوحة المجلة" : "Journal Dashboard"}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </header>

          {/* Aims & Types */}
          <section className="grid gap-6 rounded-2xl bg-card text-card-foreground p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-lg font-semibold">{t.aimsTitle}</h2>
              <ul
                className={`list-disc space-y-1 ps-5 text-foreground ${listTextClass}`}
              >
                {t.aims.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold">{t.typesTitle}</h2>
              <ul
                className={`list-disc space-y-1 ps-5 text-foreground ${listTextClass}`}
              >
                {t.types.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Open access & Review */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-card text-card-foreground p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10">
              <h2 className="mb-2 text-lg font-semibold">{t.oaTitle}</h2>
              <p className={`text-foreground ${bodyTextClass}`}>{t.oaBody}</p>
            </div>
            <div className="rounded-2xl bg-card text-card-foreground p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10">
              <h2 className="mb-2 text-lg font-semibold">{t.reviewTitle}</h2>
              <ol
                className={`list-decimal space-y-1 ps-5 text-foreground ${listTextClass}`}
              >
                {t.reviewSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </section>

          {/* Submission instructions (public) */}
          {!user && (
            <section className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">
                {lang === "ar" ? "طريقة الإرسال" : "How to Submit"}
              </h2>
              <p className={`${bodyTextClass} mb-3`}>
                {lang === "ar"
                  ? "أرسل عبر المنصة باستخدام نموذج الإرسال. ارفع ملف PDF وأدخل بيانات المقالة، ويمكنك متابعة الحالة والتعديلات من لوحة التحكم."
                  : "Submit online using our portal. Upload a PDF and provide the article details. You can track status and revisions from your dashboard."}
              </p>

              <ul className={`list-disc space-y-1 ps-5 ${isArabic ? "text-sm" : "text-xs"}`}>
                {lang === "ar" ? (
                  <>
                    <li>ملف PDF فقط (بحد أقصى 20 ميغابايت).</li>
                    <li>أدخل العنوان، المؤلفين، الانتماءات، الملخص، والكلمات المفتاحية.</li>
                    <li>أرفق روابط الشفرة/البيانات إن وُجدت.</li>
                    <li>اذكر أي استخدام لأدوات الذكاء الاصطناعي وتعارض المصالح.</li>
                  </>
                ) : (
                  <>
                    <li>PDF only (max 20 MB).</li>
                    <li>Include title, authors, affiliations, abstract, and keywords.</li>
                    <li>Add code/data links when available.</li>
                    <li>Disclose any use of AI tools and conflicts of interest.</li>
                  </>
                )}
              </ul>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="sm"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link href="/journal/submit">
                    {lang === "ar" ? "إرسال مقالة" : "Submit an Article"}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary/80"
                >
                  <Link
                    href={guidelinesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {lang === "ar" ? "دليل المؤلف (PDF)" : "Author Guidelines (PDF)"}
                  </Link>
                </Button>
              </div>

              <p className="mt-4 text-xs text-primary-foreground/80">
                {lang === "ar" ? "للاستفسار:" : "Questions:"}{" "}
                <a
                  href={`mailto:${t.email}`}
                  className="underline underline-offset-2"
                >
                  {t.email}
                </a>
              </p>
            </section>
          )}

          {/* Editorial board & Issues */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-card text-card-foreground p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10">
              <h2 className="mb-2 text-lg font-semibold">{t.boardTitle}</h2>
              <ul className="space-y-1 text-sm text-foreground">
                {t.board.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-card text-card-foreground p-6 shadow-lg border border-border ring-1 ring-black/5 dark:ring-white/10">
              <h2 className="mb-2 text-lg font-semibold">{t.issuesTitle}</h2>
              <p className="mb-4 text-sm leading-relaxed text-foreground">
                {t.issuesBody}
              </p>
              <div className="space-y-3">
                {publishedArticlesError ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {canAccessJournalDashboard
                      ? ((publishedArticlesError as any)?.message ||
                        "Failed to load published articles.")
                      : (lang === "ar"
                          ? "تعذّر تحميل المقالات المنشورة حالياً."
                          : "Failed to load published articles right now.")}
                  </div>
                ) : isArticlesLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t.issuesLoading}
                  </p>
                ) : groupedArticles.length > 0 ? (
                  <div className="space-y-4">
                    {groupedArticles.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <h3 className="text-sm font-semibold">
                          {group.label}
                        </h3>
                        <ul className="space-y-1 text-sm">
                          {group.items.map((article: any) => (
                            <li
                              key={article.id}
                              className="border-b border-border pb-2 last:border-b-0"
                            >
                              <Link
                                href={`/journal/articles/${article.id}`}
                                className="font-semibold text-primary hover:underline"
                              >
                                {article.title}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {article.authors}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.issuesEmpty}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Footer note */}
          <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
            CloudAI Journal of Applied AI & Data · CloudAI Academy & Research
            Lab · cloudaiacademy.ca
          </footer>
        </section>
      </main>
      <Footer />
    </div>
  );
}
