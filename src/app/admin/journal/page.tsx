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
  JournalArticleStatus,
  createJournalIssue,
  updateJournalArticleStatusAndIssue,
} from '@/lib/journal';
import { format } from 'date-fns';

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
  const { isAdmin, loading: roleLoading } = useCurrentRole();
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
  const canView = isAdmin === true;

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
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-10 md:py-16">
          <div className="container">
            <p className="text-center text-muted-foreground">{t.noPermission}</p>
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
                        return (
                          <TableRow key={article.id}>
                            <TableCell className="max-w-xs">
                              <div className="font-medium truncate">
                                {article.title}
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
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm">
                          No submissions yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
