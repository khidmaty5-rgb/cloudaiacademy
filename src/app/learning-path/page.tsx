'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Bot, Save } from 'lucide-react';
import {
  generatePersonalizedLearningPath,
  PersonalizedLearningPathOutput,
} from '@/ai/flows/personalized-learning-paths';
import { useUser } from '@/firebase';
import { saveLearningPath } from '@/lib/user';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/components/i18n/lang';

export default function LearningPathPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { lang, dir } = useLang();

  const t = {
    en: {
      pageTitle: 'Personalized Learning Path Generator',
      pageSubtitle: 'Let our AI craft the perfect learning journey for you.',
      formTitle: 'Tell us about yourself',
      formDescription:
        'The more details you provide, the better the recommendation.',
      interestsLabel: 'Interests',
      interestsPlaceholder: "e.g., 'Cloud Computing', 'AI', 'DevOps'",
      experienceLabel: 'Experience Level',
      experiencePlaceholder: 'Select your experience level',
      experienceBeginner: 'Beginner',
      experienceIntermediate: 'Intermediate',
      experienceAdvanced: 'Advanced',
      languageLabel: 'Language',
      languagePlaceholder: 'Select language',
      languageEn: 'English',
      languageAr: 'Arabic',
      goalsLabel: 'Career Goals',
      goalsPlaceholder:
        "e.g., 'Become a Machine Learning Engineer at a top tech company.'",
      submitButton: 'Generate My Learning Path',
      submittingButton: 'Generating Your Path...',
      errorFillAll: 'Please fill out all fields.',
      errorGenerate: 'Failed to generate learning path. Please try again.',
      loadingTitle: 'Generating your personalized path...',
      resultCardTitle: 'Your Personalized Learning Path',
      saveButton: 'Save Path',
      savingButton: 'Saving...',
      toastSavedTitle: 'Learning Path Saved!',
      toastSavedDesc: 'You can view your saved paths on your dashboard.',
      toastSaveFailedTitle: 'Save Failed',
      toastSaveFailedDesc: 'Could not save your learning path.',
    },
    ar: {
      pageTitle: 'مولِّد مسار التعلّم الشخصي',
      pageSubtitle:
        'دع نموذج الذكاء الاصطناعي لدينا يقترح لك رحلة تعلّم مناسبة.',
      formTitle: 'حدِّثنا عن نفسك',
      formDescription:
        'كلما قدّمت تفاصيل أكثر، كانت التوصية أدق وأنسب لك.',
      interestsLabel: 'الاهتمامات',
      interestsPlaceholder: "مثال: 'الحوسبة السحابية'، 'الذكاء الاصطناعي'، 'DevOps'",
      experienceLabel: 'مستوى الخبرة',
      experiencePlaceholder: 'اختر مستوى خبرتك الحالي',
      experienceBeginner: 'مبتدئ',
      experienceIntermediate: 'متوسط',
      experienceAdvanced: 'متقدم',
      languageLabel: 'لغة التعلّم المفضّلة',
      languagePlaceholder: 'اختر اللغة',
      languageEn: 'الإنجليزية',
      languageAr: 'العربية',
      goalsLabel: 'الأهداف المهنية',
      goalsPlaceholder:
        "مثال: 'أرغب في أن أصبح مهندس تعلم آلي في شركة تقنية رائدة.'",
      submitButton: 'إنشاء مسار التعلّم',
      submittingButton: 'جارٍ إنشاء مسار التعلّم...',
      errorFillAll: 'يرجى تعبئة جميع الحقول قبل المتابعة.',
      errorGenerate:
        'تعذّر إنشاء مسار التعلّم. يرجى المحاولة مرة أخرى.',
      loadingTitle: 'جارٍ إعداد مسار التعلّم الشخصي...',
      resultCardTitle: 'مسار التعلّم المقترح لك',
      saveButton: 'حفظ المسار',
      savingButton: 'جارٍ الحفظ...',
      toastSavedTitle: 'تم حفظ مسار التعلّم!',
      toastSavedDesc: 'يمكنك الرجوع إلى المسارات المحفوظة من لوحة التحكم.',
      toastSaveFailedTitle: 'تعذّر الحفظ',
      toastSaveFailedDesc: 'لم نتمكّن من حفظ مسار التعلّم. حاول مجدداً.',
    },
  }[lang];

  const [interests, setInterests] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<
    'beginner' | 'intermediate' | 'advanced' | ''
  >('');
  const [careerGoals, setCareerGoals] = useState('');
  const [language, setLanguage] = useState<'English' | 'Arabic'>('English');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<PersonalizedLearningPathOutput | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-10 md:py-16">
          <div className="mx-auto max-w-2xl">
            <Skeleton className="mb-4 h-8 w-1/2" />
            <Skeleton className="mb-8 h-4 w-3/4" />
            <Card>
              <CardHeader>
                <Skeleton className="mb-2 h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interests || !experienceLevel || !careerGoals) {
      setError(t.errorFillAll);
      return;
    }
    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await generatePersonalizedLearningPath({
        interests,
        experienceLevel:
          experienceLevel as 'beginner' | 'intermediate' | 'advanced',
        careerGoals,
        language,
      });
      setResult(response);
    } catch (err) {
      setError(t.errorGenerate);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePath = async () => {
    if (!user || !result) return;
    setIsSaving(true);
    try {
      await saveLearningPath(user.uid, result);
      toast({
        title: t.toastSavedTitle,
        description: t.toastSavedDesc,
      });
      router.push('/dashboard');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t.toastSaveFailedTitle,
        description: err?.message || t.toastSaveFailedDesc,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container mx-auto max-w-2xl" dir={dir}>
          <div className="text-center">
            <h1 className="font-headline text-3xl font-bold md:text-4xl">
              {t.pageTitle}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {t.pageSubtitle}
            </p>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t.formTitle}</CardTitle>
              <CardDescription>{t.formDescription}</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="interests">{t.interestsLabel}</Label>
                  <Input
                    id="interests"
                    placeholder={t.interestsPlaceholder}
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="experience">{t.experienceLabel}</Label>
                    <Select
                      value={experienceLevel}
                      onValueChange={(value) =>
                        setExperienceLevel(
                          value as 'beginner' | 'intermediate' | 'advanced',
                        )
                      }
                    >
                      <SelectTrigger id="experience">
                        <SelectValue placeholder={t.experiencePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">
                          {t.experienceBeginner}
                        </SelectItem>
                        <SelectItem value="intermediate">
                          {t.experienceIntermediate}
                        </SelectItem>
                        <SelectItem value="advanced">
                          {t.experienceAdvanced}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">{t.languageLabel}</Label>
                    <Select
                      value={language}
                      onValueChange={(value) =>
                        setLanguage(value as 'English' | 'Arabic')
                      }
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder={t.languagePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">{t.languageEn}</SelectItem>
                        <SelectItem value="Arabic">{t.languageAr}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">{t.goalsLabel}</Label>
                  <Textarea
                    id="goals"
                    placeholder={t.goalsPlaceholder}
                    value={careerGoals}
                    onChange={(e) => setCareerGoals(e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch">
                <Button
                  type="submit"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={isLoading}
                >
                  {isLoading ? t.submittingButton : t.submitButton}
                </Button>
                {error && (
                  <p className="mt-2 text-center text-sm text-destructive">
                    {error}
                  </p>
                )}
              </CardFooter>
            </form>
          </Card>

          {isLoading && (
            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center gap-2">
                <Sparkles className="text-accent" />
                <CardTitle>{t.loadingTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="mt-8">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-accent" />
                  <CardTitle>{t.resultCardTitle}</CardTitle>
                </div>
                <Button onClick={handleSavePath} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t.savingButton : t.saveButton}
                </Button>
              </CardHeader>
              <CardContent>
                <h3 className="mb-2 font-headline text-xl">{result.title}</h3>
                <div
                  dir={language === 'Arabic' ? 'rtl' : 'ltr'}
                  className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground md:prose-base"
                >
                  {result.description}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

