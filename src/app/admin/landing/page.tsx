'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useLang } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_PRICING,
  sanitizePricingConfig,
  type PricingConfig,
  type PricingFeature,
  type PricingPlan,
  type SupportedLang,
} from '@/lib/landing-pricing';

type PricingPlanDraft = Omit<PricingPlan, 'features'> & { featuresText: string };
type PricingConfigDraft = Omit<PricingConfig, 'plans'> & { plans: PricingPlanDraft[] };

type PricingSettingsDraft = {
  showPricing: boolean;
  pricing: Record<SupportedLang, PricingConfigDraft>;
};

function featuresToText(features: PricingFeature[]) {
  return (features || [])
    .map((f) => `${f.included ? '+' : '-'} ${f.text}`.trim())
    .join('\n');
}

function textToFeatures(text: string): PricingFeature[] {
  return (text || '')
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const included = !line.startsWith('-');
      const cleaned = line.replace(/^[-+]\s*/, '').trim();
      return { text: cleaned, included };
    })
    .filter((f) => f.text.length > 0);
}

function configToDraft(config: PricingConfig): PricingConfigDraft {
  return {
    ...config,
    plans: (config.plans || []).map((p) => ({
      ...p,
      featuresText: featuresToText(p.features || []),
    })),
  };
}

function draftToConfig(draft: PricingConfigDraft): PricingConfig {
  return {
    ...draft,
    plans: (draft.plans || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      isFeatured: !!p.isFeatured,
      features: textToFeatures(p.featuresText),
    })),
  };
}

function newPlanId() {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID() as string;
    }
  } catch {}
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AdminLandingPricingPage() {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { toast } = useToast();
  const { lang } = useLang();
  const t = useMemo(
    () =>
      ({
        en: {
          pageTitle: 'Landing Page: Pricing Section',
          noPermission: 'You do not have permission to view this page.',
          showPricing: 'Show pricing section',
          save: 'Save changes',
          saving: 'Saving…',
          resetSaved: 'Reset to saved',
          resetDefaults: 'Reset to defaults',
          saved: 'Saved',
          saveFailed: 'Save failed',
          english: 'English',
          arabic: 'Arabic',
          section: 'Section',
          heading: 'Heading',
          subtitle: 'Subtitle',
          period: 'Billing period label',
          mostPopular: '“Most popular” label',
          buttonText: 'Button text',
          plans: 'Plans',
          addPlan: 'Add plan',
          removePlan: 'Remove plan',
          planName: 'Plan name',
          planPrice: 'Price',
          featured: 'Featured',
          features: 'Features',
          featuresHelp: 'One per line. Prefix with + (included) or - (not included).',
        },
        ar: {
          pageTitle: 'الصفحة الرئيسية: قسم الأسعار',
          noPermission: 'ليست لديك صلاحية لعرض هذه الصفحة.',
          showPricing: 'إظهار قسم الأسعار',
          save: 'حفظ التغييرات',
          saving: 'جارٍ الحفظ…',
          resetSaved: 'إعادة إلى المحفوظ',
          resetDefaults: 'إعادة إلى الافتراضي',
          saved: 'تم الحفظ',
          saveFailed: 'فشل الحفظ',
          english: 'English',
          arabic: 'العربية',
          section: 'القسم',
          heading: 'العنوان',
          subtitle: 'الوصف',
          period: 'نص فترة الفوترة',
          mostPopular: 'نص “الأكثر شيوعاً”',
          buttonText: 'نص الزر',
          plans: 'الباقات',
          addPlan: 'إضافة باقة',
          removePlan: 'حذف الباقة',
          planName: 'اسم الباقة',
          planPrice: 'السعر',
          featured: 'مميز',
          features: 'المميزات',
          featuresHelp: 'سطر لكل ميزة. ضع + (متاح) أو - (غير متاح).',
        },
      } as const)[lang],
    [lang],
  );

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: uiSettings, isLoading: isSettingsLoading } = useDoc<any>(settingsDocRef);

  const [draft, setDraft] = useState<PricingSettingsDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canViewPage = isAdmin === true;
  const isLoading = isUserLoading || roleLoading || isSettingsLoading;

  const makeDraftFromSettings = useMemo(
    () => (settings: any | undefined | null): PricingSettingsDraft => {
      const showPricing = settings?.showPricing !== false;
      const en = configToDraft(
        sanitizePricingConfig(settings?.pricing?.en, DEFAULT_PRICING.en),
      );
      const ar = configToDraft(
        sanitizePricingConfig(settings?.pricing?.ar, DEFAULT_PRICING.ar),
      );
      return { showPricing, pricing: { en, ar } };
    },
    [],
  );

  useEffect(() => {
    if (draft) return;
    setDraft(makeDraftFromSettings(uiSettings));
  }, [draft, makeDraftFromSettings, uiSettings]);

  const updateLang = (language: SupportedLang, updater: (current: PricingConfigDraft) => PricingConfigDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, pricing: { ...prev.pricing, [language]: updater(prev.pricing[language]) } };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!user) return;
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const payload = {
        showPricing: draft.showPricing,
        pricing: {
          en: draftToConfig(draft.pricing.en),
          ar: draftToConfig(draft.pricing.ar),
        },
      };
      await setDoc(settingsDocRef as any, payload, { merge: true });
      toast({ title: t.saved });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: t.saveFailed,
        description: e?.message || 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-5xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="font-headline text-3xl md:text-4xl font-bold">{t.pageTitle}</h1>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(makeDraftFromSettings(uiSettings))}
                disabled={!draft || isSaving}
              >
                {t.resetSaved}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(makeDraftFromSettings({ showPricing: true, pricing: DEFAULT_PRICING }))}
                disabled={!draft || isSaving}
              >
                {t.resetDefaults}
              </Button>
              <Button type="button" onClick={handleSave} disabled={!draft || isSaving}>
                {isSaving ? t.saving : t.save}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !canViewPage ? (
            <p className="text-muted-foreground">{t.noPermission}</p>
          ) : !draft ? null : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t.section}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{t.showPricing}</p>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'ar'
                        ? 'يمكنك إخفاء قسم الأسعار بالكامل من الصفحة الرئيسية.'
                        : 'Hide or show the pricing section on the homepage.'}
                    </p>
                  </div>
                  <Switch
                    checked={draft.showPricing}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => (prev ? { ...prev, showPricing: !!checked } : prev))
                    }
                  />
                </CardContent>
              </Card>

              <Tabs defaultValue="en">
                <TabsList>
                  <TabsTrigger value="en">{t.english}</TabsTrigger>
                  <TabsTrigger value="ar">{t.arabic}</TabsTrigger>
                </TabsList>

                {(['en', 'ar'] as const).map((language) => {
                  const cfg = draft.pricing[language];
                  return (
                    <TabsContent key={language} value={language} className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>{language === 'ar' ? t.arabic : t.english}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t.heading}</label>
                              <Input
                                value={cfg.heading}
                                onChange={(e) =>
                                  updateLang(language, (c) => ({ ...c, heading: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t.buttonText}</label>
                              <Input
                                value={cfg.buttonText}
                                onChange={(e) =>
                                  updateLang(language, (c) => ({ ...c, buttonText: e.target.value }))
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t.subtitle}</label>
                            <Textarea
                              value={cfg.sub}
                              onChange={(e) =>
                                updateLang(language, (c) => ({ ...c, sub: e.target.value }))
                              }
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t.period}</label>
                              <Input
                                value={cfg.period}
                                onChange={(e) =>
                                  updateLang(language, (c) => ({ ...c, period: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t.mostPopular}</label>
                              <Input
                                value={cfg.mostPopular}
                                onChange={(e) =>
                                  updateLang(language, (c) => ({ ...c, mostPopular: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>{t.plans}</CardTitle>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              updateLang(language, (c) => ({
                                ...c,
                                plans: [
                                  ...c.plans,
                                  {
                                    id: newPlanId(),
                                    name: '',
                                    price: '',
                                    isFeatured: false,
                                    featuresText: '+ ',
                                  },
                                ],
                              }))
                            }
                          >
                            {t.addPlan}
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {cfg.plans.map((plan, index) => (
                            <div key={plan.id} className="rounded-lg border p-4 space-y-4">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="text-sm font-medium">
                                  {lang === 'ar' ? `الباقة ${index + 1}` : `Plan ${index + 1}`}
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={() =>
                                    updateLang(language, (c) => ({
                                      ...c,
                                      plans: c.plans.filter((_, i) => i !== index),
                                    }))
                                  }
                                  disabled={cfg.plans.length <= 1}
                                >
                                  {t.removePlan}
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                  <label className="text-sm font-medium">{t.planName}</label>
                                  <Input
                                    value={plan.name}
                                    onChange={(e) =>
                                      updateLang(language, (c) => ({
                                        ...c,
                                        plans: c.plans.map((p, i) =>
                                          i === index ? { ...p, name: e.target.value } : p,
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">{t.planPrice}</label>
                                  <Input
                                    value={plan.price}
                                    onChange={(e) =>
                                      updateLang(language, (c) => ({
                                        ...c,
                                        plans: c.plans.map((p, i) =>
                                          i === index ? { ...p, price: e.target.value } : p,
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">{t.featured}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {lang === 'ar'
                                      ? 'سيظهر شارة “الأكثر شيوعاً”.'
                                      : 'Shows the “most popular” badge.'}
                                  </p>
                                </div>
                                <Switch
                                  checked={!!plan.isFeatured}
                                  onCheckedChange={(checked) =>
                                    updateLang(language, (c) => ({
                                      ...c,
                                      plans: c.plans.map((p, i) =>
                                        i === index ? { ...p, isFeatured: !!checked } : p,
                                      ),
                                    }))
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium">{t.features}</label>
                                <Textarea
                                  value={plan.featuresText}
                                  onChange={(e) =>
                                    updateLang(language, (c) => ({
                                      ...c,
                                      plans: c.plans.map((p, i) =>
                                        i === index ? { ...p, featuresText: e.target.value } : p,
                                      ),
                                    }))
                                  }
                                  rows={6}
                                />
                                <p className="text-xs text-muted-foreground">{t.featuresHelp}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

