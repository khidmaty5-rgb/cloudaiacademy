'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/landing/header';
import Footer from '@/components/landing/footer';
import { useLang } from '@/components/i18n/lang';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_PAYMENT_SETTINGS,
  sanitizePaymentSettings,
  type PaymentInterval,
  type PaymentPlanId,
  type PaymentSettings,
} from '@/lib/payment-settings';

const PLAN_ORDER: PaymentPlanId[] = ['basic', 'pro', 'enterprise'];

export default function AdminPaymentSettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = getFirestore();
  const { isAdmin, loading: roleLoading } = useCurrentRole();
  const { lang } = useLang();
  const { toast } = useToast();

  const t = useMemo(() => {
    const en = {
      pageTitle: 'Payment Settings',
      noPermission: 'You do not have permission to view this page.',
      save: 'Save Settings',
      saving: 'Saving...',
      saved: 'Saved',
      savedDesc: 'Payment settings updated.',
      failed: 'Save failed',
      failedDesc: 'Could not save payment settings.',
      paymentsEnabled: 'Enable payments',
      provider: 'Provider',
      model: 'Model',
      currency: 'Currency',
      intervals: 'Billing intervals',
      defaultInterval: 'Default interval',
      paywall: 'Paywall',
      paywallEnabled: 'Enable paywall',
      defaultRequirePayment: 'New students require payment by default',
      plans: 'Plans',
      planEnabled: 'Enabled',
      contactOnly: 'Enterprise/contact-only',
      stripePriceIds: 'Stripe Price IDs',
      monthlyPriceId: 'Monthly price ID',
      yearlyPriceId: 'Yearly price ID',
      oneTimePriceId: 'One-time price ID',
      enterpriseContact: 'Enterprise contact',
      contactEmail: 'Contact email',
      contactUrl: 'Contact URL',
      noteTitle: 'Important',
      noteBody:
        'Do NOT store Stripe secret keys in Firestore. Use env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) in your hosting environment.',
    };
    const ar = en;
    return lang === 'ar' ? ar : en;
  }, [lang]);

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'payment'), [firestore]);
  const { data: paymentDoc, isLoading: isPaymentDocLoading } = useDoc(settingsDocRef);

  const [draft, setDraft] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = sanitizePaymentSettings(paymentDoc, DEFAULT_PAYMENT_SETTINGS);
    setDraft(next);
  }, [paymentDoc]);

  const isLoading = isUserLoading || roleLoading || isPaymentDocLoading;
  const canView = isAdmin === true;

  const setPlan = (planId: PaymentPlanId, updater: (prev: PaymentSettings['plans'][PaymentPlanId]) => PaymentSettings['plans'][PaymentPlanId]) => {
    setDraft((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [planId]: updater(prev.plans[planId]),
      },
    }));
  };

  const setInterval = (key: 'month' | 'year', value: boolean) => {
    setDraft((prev) => {
      const nextIntervals = { ...prev.intervals, [key]: value };
      const anyEnabled = nextIntervals.month || nextIntervals.year;
      if (!anyEnabled) {
        // Never allow both to be off; keep the last change.
        nextIntervals[key] = true;
      }
      if (nextIntervals.default === 'month' && !nextIntervals.month) nextIntervals.default = 'year';
      if (nextIntervals.default === 'year' && !nextIntervals.year) nextIntervals.default = 'month';
      return { ...prev, intervals: nextIntervals };
    });
  };

  const handleSave = async () => {
    if (!canView) return;
    setSaving(true);
    try {
      const sanitized = sanitizePaymentSettings(draft, DEFAULT_PAYMENT_SETTINGS);
      await setDoc(settingsDocRef, sanitized, { merge: true });
      toast({ title: t.saved, description: t.savedDesc });
    } catch {
      toast({ variant: 'destructive', title: t.failed, description: t.failedDesc });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10 md:py-16">
        <div className="container max-w-5xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {isLoading ? (
              <Skeleton className="h-10 w-64" />
            ) : (
              <h1 className="font-headline text-3xl md:text-4xl font-bold">{t.pageTitle}</h1>
            )}
            {canView && (
              <Button onClick={handleSave} disabled={saving || !user}>
                {saving ? t.saving : t.save}
              </Button>
            )}
          </div>

          {!isLoading && !canView && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t.noPermission}</p>
            </div>
          )}

          {canView && (
            <div className="mt-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.noteTitle}</CardTitle>
                  <CardDescription>{t.noteBody}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.pageTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-medium">{t.paymentsEnabled}</div>
                      <div className="text-sm text-muted-foreground">
                        {draft.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <Switch
                      checked={draft.enabled}
                      onCheckedChange={(checked) => setDraft((p) => ({ ...p, enabled: !!checked }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.provider}</label>
                      <Select
                        value={draft.provider}
                        onValueChange={(v) =>
                          setDraft((p) => ({ ...p, provider: (v as any) || p.provider }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.model}</label>
                      <Select
                        value={draft.model}
                        onValueChange={(v) =>
                          setDraft((p) => ({ ...p, model: (v as any) || p.model }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subscription">Subscription</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                          <SelectItem value="per_course">Per course</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.currency}</label>
                      <Select
                        value={draft.currency}
                        onValueChange={(v) =>
                          setDraft((p) => ({ ...p, currency: (v as any) || p.currency }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAD">CAD</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-medium">{t.intervals}</div>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={draft.intervals.month}
                          onCheckedChange={(checked) => setInterval('month', !!checked)}
                        />
                        <span className="text-sm">Monthly</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={draft.intervals.year}
                          onCheckedChange={(checked) => setInterval('year', !!checked)}
                        />
                        <span className="text-sm">Yearly</span>
                      </div>
                      <div className="min-w-[220px] space-y-2">
                        <label className="text-sm font-medium">{t.defaultInterval}</label>
                        <Select
                          value={draft.intervals.default}
                          onValueChange={(v) =>
                            setDraft((p) => ({
                              ...p,
                              intervals: {
                                ...p.intervals,
                                default: (v as PaymentInterval) || p.intervals.default,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month" disabled={!draft.intervals.month}>
                              Monthly
                            </SelectItem>
                            <SelectItem value="year" disabled={!draft.intervals.year}>
                              Yearly
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.paywall}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-medium">{t.paywallEnabled}</div>
                      <div className="text-sm text-muted-foreground">
                        {draft.paywall.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <Switch
                      checked={draft.paywall.enabled}
                      onCheckedChange={(checked) =>
                        setDraft((p) => ({ ...p, paywall: { ...p.paywall, enabled: !!checked } }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-medium">{t.defaultRequirePayment}</div>
                      <div className="text-sm text-muted-foreground">
                        {draft.paywall.defaultRequirePayment ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <Switch
                      checked={draft.paywall.defaultRequirePayment}
                      onCheckedChange={(checked) =>
                        setDraft((p) => ({
                          ...p,
                          paywall: { ...p.paywall, defaultRequirePayment: !!checked },
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.plans}</CardTitle>
                  <CardDescription>{t.stripePriceIds}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {PLAN_ORDER.map((planId) => {
                    const plan = draft.plans[planId];
                    const label =
                      planId === 'basic' ? 'Basic' : planId === 'pro' ? 'Pro' : 'Enterprise';

                    return (
                      <div key={planId} className="rounded-lg border p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="font-medium">{label}</div>
                            <div className="text-sm text-muted-foreground">
                              {plan.enabled ? 'Enabled' : 'Disabled'}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 flex-wrap">
                            <div className="flex items-center gap-3">
                              <span className="text-sm">{t.planEnabled}</span>
                              <Switch
                                checked={plan.enabled}
                                onCheckedChange={(checked) =>
                                  setPlan(planId, (p) => ({ ...p, enabled: !!checked }))
                                }
                              />
                            </div>
                            {planId === 'enterprise' && (
                              <div className="flex items-center gap-3">
                                <span className="text-sm">{t.contactOnly}</span>
                                <Switch
                                  checked={plan.contactOnly}
                                  onCheckedChange={(checked) =>
                                    setPlan(planId, (p) => ({ ...p, contactOnly: !!checked }))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {draft.provider === 'stripe' && !plan.contactOnly && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {draft.model === 'subscription' ? (
                              <>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">{t.monthlyPriceId}</label>
                                  <Input
                                    value={plan.stripe.monthlyPriceId}
                                    onChange={(e) =>
                                      setPlan(planId, (p) => ({
                                        ...p,
                                        stripe: { ...p.stripe, monthlyPriceId: e.target.value },
                                      }))
                                    }
                                    placeholder="price_..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">{t.yearlyPriceId}</label>
                                  <Input
                                    value={plan.stripe.yearlyPriceId}
                                    onChange={(e) =>
                                      setPlan(planId, (p) => ({
                                        ...p,
                                        stripe: { ...p.stripe, yearlyPriceId: e.target.value },
                                      }))
                                    }
                                    placeholder="price_..."
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium">{t.oneTimePriceId}</label>
                                <Input
                                  value={plan.stripe.oneTimePriceId}
                                  onChange={(e) =>
                                    setPlan(planId, (p) => ({
                                      ...p,
                                      stripe: { ...p.stripe, oneTimePriceId: e.target.value },
                                    }))
                                  }
                                  placeholder="price_..."
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.enterpriseContact}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.contactEmail}</label>
                    <Input
                      value={draft.enterpriseContact.email}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          enterpriseContact: { ...p.enterpriseContact, email: e.target.value },
                        }))
                      }
                      placeholder="billing@yourdomain.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.contactUrl}</label>
                    <Input
                      value={draft.enterpriseContact.url}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          enterpriseContact: { ...p.enterpriseContact, url: e.target.value },
                        }))
                      }
                      placeholder="https://yourdomain.com/contact"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
