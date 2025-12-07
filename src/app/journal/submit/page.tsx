"use client";

import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useLang } from '@/components/i18n/lang';
import { useUser } from '@/firebase';
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
import { submitJournalArticle } from '@/lib/journal';

export default function JournalSubmitPage() {
  const { lang, dir } = useLang();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!isUserLoading && !user) {
      toast({
        variant: 'destructive',
        title: t.mustLogin,
      });
      router.push('/login');
    }
  }, [isUserLoading, user, router, toast, t.mustLogin]);

  const [form, setForm] = useState({
    title: '',
    abstract: '',
    authors: '',
    language: lang === 'ar' ? 'ar' : 'en',
    pdfUrl: '',
    codeUrl: '',
  });

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
      await submitJournalArticle(
        {
          title: form.title.trim(),
          abstract: form.abstract.trim(),
          authors: form.authors.trim(),
          language: form.language as 'en' | 'ar' | 'both',
          pdfUrl: form.pdfUrl.trim(),
          codeUrl: form.codeUrl.trim() || undefined,
        },
        user.uid,
      );
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
                    <label className="text-sm font-medium">
                      {t.fieldPdfUrl}
                    </label>
                    <Input
                      value={form.pdfUrl}
                      onChange={handleChange('pdfUrl')}
                      placeholder={t.fieldPdfUrlPlaceholder}
                      type="url"
                      required
                    />
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

