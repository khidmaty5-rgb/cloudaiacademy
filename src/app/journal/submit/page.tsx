"use client";

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore } from 'firebase/firestore';

export default function JournalSubmitPage() {
  const { lang, dir } = useLang();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui, isLoading: isUiLoading } = useDoc<any>(settingsDocRef);
  const journalEnabled = ui?.showJournalNav !== false;

  useEffect(() => {
    if (isUiLoading) return;
    if (!journalEnabled) router.replace('/');
  }, [isUiLoading, journalEnabled, router]);

  const t = {
    en: {
      title: 'Submit an Article',
      description:
        'Share your work with the CloudAI Journal of Applied AI & Data.',
      mustLogin: 'You must be logged in to submit an article.',
      fieldTitle: 'Article Title',
      fieldTitlePlaceholder: 'e.g., Applied ML for Local Energy Forecasting',
      fieldAbstract: 'Abstract',
      fieldAbstractPlaceholder:
        'A short summary of the problem, methods, and key results.',
      fieldAuthors: 'Authors',
      fieldAuthorsPlaceholder: 'Names and affiliations (comma separated).',
      fieldLanguage: 'Language',
      languageEn: 'English',
      languageAr: 'Arabic',
      languageBoth: 'Bilingual (English & Arabic)',
      fieldPdfUrl: 'PDF URL',
      fieldPdfUrlPlaceholder:
        'Link to the PDF (e.g., Google Drive / GitHub / Cloud storage).',
      fieldCodeUrl: 'Code / Data URL (optional)',
      fieldCodeUrlPlaceholder:
        'Link to code or data repository, if available.',
      submitButton: 'Submit Article',
      submittingButton: 'Submitting...',
      toastSuccessTitle: 'Submission received!',
      toastSuccessDesc:
        'Your article has been submitted for editorial review.',
      toastErrorTitle: 'Submission failed',
    },
    ar: {
      title: 'إرسال مقالة للمجلة',
      description:
        'شارك عملك مع مجلة كلاود أي آي للأبحاث التطبيقية والبيانات.',
      mustLogin: 'يجب تسجيل الدخول لإرسال مقالة.',
      fieldTitle: 'عنوان المقالة',
      fieldTitlePlaceholder: 'مثال: التعلم الآلي التطبيقي لتنبؤ استهلاك الطاقة',
      fieldAbstract: 'الملخص',
      fieldAbstractPlaceholder:
        'ملخص قصير للمشكلة والمنهجية والنتائج الرئيسية.',
      fieldAuthors: 'المؤلفون',
      fieldAuthorsPlaceholder: 'الأسماء والانتماءات (مفصولة بفواصل).',
      fieldLanguage: 'لغة المقالة',
      languageEn: 'الإنجليزية',
      languageAr: 'العربية',
      languageBoth: 'ثنائية اللغة (العربية والإنجليزية)',
      fieldPdfUrl: 'رابط ملف PDF',
      fieldPdfUrlPlaceholder:
        'رابط ملف PDF (مثل Google Drive أو GitHub أو تخزين سحابي).',
      fieldCodeUrl: 'رابط الكود / البيانات (اختياري)',
      fieldCodeUrlPlaceholder:
        'رابط لمستودع الكود أو البيانات إن وجد.',
      submitButton: 'إرسال المقالة',
      submittingButton: 'جارٍ الإرسال...',
      toastSuccessTitle: 'تم استلام الإرسال!',
      toastSuccessDesc:
        'تم إرسال مقالتك للمراجعة التحريرية.',
      toastErrorTitle: 'فشل في الإرسال',
    },
  }[lang];

  useEffect(() => {
    if (isUiLoading || !journalEnabled) return;
    if (!isUserLoading && !user) {
      toast({
        variant: 'destructive',
        title: t.mustLogin,
      });
      router.push('/login');
    }
  }, [isUiLoading, journalEnabled, isUserLoading, user, router, toast, t.mustLogin]);

  const [form, setForm] = useState({
    title: '',
    abstract: '',
    authors: '',
    language: lang === 'ar' ? 'ar' : 'en',
    affiliations: '',
    keywords: '',
    license: 'CC BY 4.0',
    codeUrl: '',
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Validation
      const title = form.title.trim();
      const abstract = form.abstract.trim();
      const authors = form.authors.trim();
      const language = (form.language as 'en' | 'ar' | 'both');
      const codeUrl = form.codeUrl.trim() || undefined;
      const affiliationsArr = form.affiliations
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const keywordsArr = form.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const license = form.license || 'CC BY 4.0';

      if (!title || !abstract || !authors) {
        throw new Error('Title, abstract, and authors are required.');
      }
      if (!(language === 'en' || language === 'ar' || language === 'both')) {
        throw new Error('Language must be en, ar, or both.');
      }
      if (!pdfFile) {
        throw new Error('Please attach a PDF file.');
      }
      const maxBytes = 20 * 1024 * 1024;
      if (pdfFile.size > maxBytes) {
        throw new Error('PDF is too large. Max size is 20 MB.');
      }
      const isPdf = (pdfFile.type === 'application/pdf') || pdfFile.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        throw new Error('File must be a PDF (application/pdf).');
      }

      // Prepare articleId and upload to MinIO via presigned PUT
      const articleId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const s3Key = `journal/articles/${user.uid}/${articleId}/manuscript.pdf`;
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) throw new Error('Unauthorized');

      const presignResp = await fetch('/api/s3/presign-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: s3Key, contentType: 'application/pdf' }),
      });
      if (!presignResp.ok) {
        const errJ = await presignResp.json().catch(() => undefined);
        throw new Error(errJ?.error || 'Failed to create upload URL');
      }
      const { url: uploadUrl } = await presignResp.json();
      const putResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfFile,
      });
      if (!putResp.ok) {
        throw new Error(`Upload failed with status ${putResp.status}`);
      }

      // Server-side validated creation
      const resp = await fetch('/api/journal/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          articleId,
          title,
          abstract,
          authors,
          affiliations: affiliationsArr,
          keywords: keywordsArr,
          license,
          language: language === 'both' ? 'en' : language, // restrict to en|ar server side
          codeUrl,
          pdfPath: s3Key,
        }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        throw new Error(j?.error || 'Submission failed');
      }
      toast({
        title: t.toastSuccessTitle,
        description: t.toastSuccessDesc,
      });
      router.push('/journal');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t.toastErrorTitle,
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
      <main className="flex-1 py-10 md:py-16 bg-background">
        <div className="container max-w-3xl">
          <section dir={dir} className="space-y-6">
            <header className="space-y-2 mb-4">
              <h1 className="font-headline text-3xl md:text-4xl font-bold">
                {t.title}
              </h1>
              <p className="text-sm md:text-base text-foreground">
                {t.description}
              </p>
            </header>

            <Card>
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>
                  {t.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.fieldTitle}
                    </label>
                    <Input
                      value={form.title}
                      onChange={handleChange('title')}
                      placeholder={t.fieldTitlePlaceholder}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.fieldAbstract}
                    </label>
                    <Textarea
                      value={form.abstract}
                      onChange={handleChange('abstract')}
                      placeholder={t.fieldAbstractPlaceholder}
                      rows={6}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.fieldAuthors}
                    </label>
                    <Input
                      value={form.authors}
                      onChange={handleChange('authors')}
                      placeholder={t.fieldAuthorsPlaceholder}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.fieldLanguage}
                    </label>
                    <Select
                      value={form.language}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, language: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{t.languageEn}</SelectItem>
                        <SelectItem value="ar">{t.languageAr}</SelectItem>
                        <SelectItem value="both">
                          {t.languageBoth}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">PDF (max 20 MB)</label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Affiliations (one per line, align order with authors)</label>
                    <Textarea
                      value={form.affiliations}
                      onChange={handleChange('affiliations')}
                      placeholder={lang==='ar' ? 'جامعة طرابلس\nجامعة بنغازي' : 'University of Tripoli\nUniversity of Benghazi'}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keywords (comma separated)</label>
                    <Input
                      value={form.keywords}
                      onChange={handleChange('keywords')}
                      placeholder={lang==='ar' ? 'ذكاء اصطناعي، بيانات، سحابة' : 'AI, data, cloud'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">License</label>
                    <select
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={form.license}
                      onChange={(e) => setForm((p) => ({ ...p, license: e.target.value }))}
                    >
                      <option value="CC BY 4.0">CC BY 4.0</option>
                      <option value="All rights reserved">All rights reserved</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.fieldCodeUrl}
                    </label>
                    <Input
                      value={form.codeUrl}
                      onChange={handleChange('codeUrl')}
                      placeholder={t.fieldCodeUrlPlaceholder}
                      type="url"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !user}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isSubmitting ? t.submittingButton : t.submitButton}
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
