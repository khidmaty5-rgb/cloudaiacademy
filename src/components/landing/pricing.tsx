'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { DEFAULT_PRICING, sanitizePricingConfig } from '@/lib/landing-pricing';
import {
  DEFAULT_PAYMENT_SETTINGS,
  getPlanCheckoutKind,
  getStripePriceId,
  sanitizePaymentSettings,
  type PaymentInterval,
  type PaymentPlanId,
} from '@/lib/payment-settings';
import { useToast } from '@/hooks/use-toast';
import { getAuth } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// plans are derived inside the component based on language

export default function Pricing() {
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
  const paymentDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'payment'), [firestore]);
  const { data: paymentDoc } = useDoc<any>(paymentDocRef);
  const payment = useMemo(
    () => sanitizePaymentSettings(paymentDoc, DEFAULT_PAYMENT_SETTINGS),
    [paymentDoc],
  );
  const { user } = useUser();
  const { toast } = useToast();
  const { lang } = useLang();
  const heading = lang === 'ar' ? 'خطط تعلم مرنة' : 'Flexible Learning Plans';
  const sub =
    lang === 'ar'
      ? 'اختر الخطة الأنسب لرحلتك التعليمية.'
      : 'Choose the plan that works best for your learning journey.';
  const period = lang === 'ar' ? 'شهريًا' : 'per month';
  const mostPopular = lang === 'ar' ? 'الأكثر شيوعًا' : 'Most Popular';
  const btnText = lang === 'ar' ? 'ابدأ الآن' : 'Get Started';
  const plans =
    lang === 'ar'
      ? [
          {
            name: 'أساسي',
            price: '$29',
            period,
            features: [
              { text: 'وصول إلى أكثر من 50 دورة', included: true },
              { text: 'دعم المجتمع', included: true },
              { text: 'تحديات أسبوعية', included: true },
              { text: 'شهادة إتمام', included: false },
              { text: 'إرشاد فردي 1-1', included: false },
            ],
            isFeatured: false,
          },
          {
            name: 'احترافي',
            price: '$79',
            period,
            features: [
              { text: 'وصول إلى جميع الدورات', included: true },
              { text: 'دعم أولوية', included: true },
              { text: 'مشاريع واقعية', included: true },
              { text: 'شهادة إتمام', included: true },
              { text: 'إرشاد فردي 1-1', included: false },
            ],
            isFeatured: true,
          },
          {
            name: 'مؤسسي',
            price: '$149',
            period,
            features: [
              { text: 'وصول إلى جميع الدورات', included: true },
              { text: 'دعم متميز على مدار الساعة', included: true },
              { text: 'مشاريع واقعية', included: true },
              { text: 'شهادة إتمام', included: true },
              { text: 'إرشاد أسبوعي 1-1', included: true },
            ],
            isFeatured: false,
          },
        ]
      : [
          {
            name: 'Basic',
            price: '$29',
            period,
            features: [
              { text: 'Access to 50+ courses', included: true },
              { text: 'Community support', included: true },
              { text: 'Weekly challenges', included: true },
              { text: 'Certificate of completion', included: false },
              { text: '1-on-1 mentoring', included: false },
            ],
            isFeatured: false,
          },
          {
            name: 'Pro',
            price: '$79',
            period,
            features: [
              { text: 'Access to all courses', included: true },
              { text: 'Priority support', included: true },
              { text: 'Real-world projects', included: true },
              { text: 'Certificate of completion', included: true },
              { text: '1-on-1 mentoring', included: false },
            ],
            isFeatured: true,
          },
          {
            name: 'Enterprise',
            price: '$149',
            period,
            features: [
              { text: 'Access to all courses', included: true },
              { text: '24/7 premium support', included: true },
              { text: 'Real-world projects', included: true },
              { text: 'Certificate of completion', included: true },
              { text: 'Weekly 1-on-1 mentoring', included: true },
            ],
            isFeatured: false,
          },
        ];
  const showPricing = ui?.showPricing !== false; // default: show

  const config = sanitizePricingConfig(ui?.pricing?.[lang], DEFAULT_PRICING[lang]);
  const resolvedHeading = config.heading || heading;
  const resolvedSub = config.sub || sub;
  const resolvedPeriod = config.period || period;
  const resolvedMostPopular = config.mostPopular || mostPopular;
  const resolvedButtonText = config.buttonText || btnText;
  const resolvedPlans = config.plans.length > 0 ? config.plans : plans;

  const availableIntervals = useMemo(() => {
    const out: PaymentInterval[] = [];
    if (payment.intervals.month) out.push('month');
    if (payment.intervals.year) out.push('year');
    if (!out.length) out.push('month');
    return out;
  }, [payment.intervals.month, payment.intervals.year]);

  const [billingInterval, setBillingInterval] = useState<PaymentInterval>(payment.intervals.default);
  useEffect(() => {
    if (!availableIntervals.includes(payment.intervals.default)) {
      setBillingInterval(availableIntervals[0]);
      return;
    }
    setBillingInterval(payment.intervals.default);
  }, [payment.intervals.default, availableIntervals]);

  const canUseStripeCheckout =
    payment.enabled && payment.provider === 'stripe' && (payment.model === 'subscription' || payment.model === 'one_time');

  const checkoutLabel = lang === 'ar' ? 'إتمام الدفع' : 'Checkout';
  const contactUsLabel = lang === 'ar' ? 'تواصل معنا' : 'Contact us';

  const handleCheckout = async (planIdRaw: unknown) => {
    const planId = (typeof planIdRaw === 'string' ? planIdRaw : '').trim() as PaymentPlanId;
    if (planId !== 'basic' && planId !== 'pro' && planId !== 'enterprise') return;

    if (!payment.enabled) {
      window.location.href = user ? '/dashboard' : '/signup';
      return;
    }

    const kind = getPlanCheckoutKind(payment, planId);
    if (kind === 'disabled') return;

    if (kind === 'contact') {
      const url = payment.enterpriseContact.url || '';
      const email = payment.enterpriseContact.email || '';
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (email) {
        window.location.href = `mailto:${email}?subject=${encodeURIComponent('Enterprise plan')}`;
        return;
      }
      toast({ title: contactUsLabel, description: 'Contact details are not configured.' });
      return;
    }

    if (!canUseStripeCheckout) {
      toast({ title: 'Payments disabled', description: 'Ask an admin to enable payments.' });
      return;
    }

    if (!user) {
      window.location.href = '/signup';
      return;
    }

    const priceId = getStripePriceId(payment, planId, billingInterval);
    if (!priceId) {
      toast({
        variant: 'destructive',
        title: 'Missing Stripe price',
        description: `No Stripe price configured for ${planId} (${billingInterval}).`,
      });
      return;
    }

    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const resp = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId, interval: billingInterval }),
      });
      const j = (await resp.json().catch(() => null)) as any;
      if (!resp.ok || !j?.url) {
        const msg = j?.error || 'Failed to start checkout.';
        throw new Error(msg);
      }
      window.location.href = j.url as string;
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout failed',
        description: e?.message || 'Please try again.',
      });
    }
  };

  if (!showPricing) return null;

  return (
    <section id="pricing" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {resolvedHeading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {resolvedSub}
          </p>
        </div>
        {payment.enabled && payment.model === 'subscription' && availableIntervals.length > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-xs">
              <Select value={billingInterval} onValueChange={(v) => setBillingInterval(v as PaymentInterval)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableIntervals.includes('month') && <SelectItem value="month">Monthly</SelectItem>}
                  {availableIntervals.includes('year') && <SelectItem value="year">Yearly</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {resolvedPlans.map((plan) => {
            const rawPlanId = (plan as any).id ?? plan.name;
            const planId: PaymentPlanId | null =
              rawPlanId === 'basic' || rawPlanId === 'pro' || rawPlanId === 'enterprise'
                ? (rawPlanId as PaymentPlanId)
                : null;
            const kind = planId ? getPlanCheckoutKind(payment, planId) : ('unsupported' as const);
            const hasPrice = planId ? !!getStripePriceId(payment, planId, billingInterval) : false;
            const buttonText = !payment.enabled
              ? resolvedButtonText
              : kind === 'contact'
                ? contactUsLabel
                : kind === 'stripe'
                  ? checkoutLabel
                  : resolvedButtonText;
            const buttonDisabled =
              payment.enabled &&
              (kind === 'disabled' || kind === 'unsupported' || (kind === 'stripe' && !hasPrice));

            return (
              <Card
                key={(plan as any).id ?? plan.name}
              className={cn(
                'flex flex-col h-full',
                (plan as any).isFeatured
                  ? 'border-2 border-accent shadow-accent/20 shadow-lg relative scale-105'
                  : 'border'
              )}
            >
              {(plan as any).isFeatured && (
                <Badge className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                  {resolvedMostPopular}
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl">
                  {plan.name}
                </CardTitle>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-primary">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{resolvedPeriod}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  {plan.features.map((feature: any, index: number) => (
                    <li
                      key={`${(plan as any).id ?? plan.name}-feature-${index}`}
                      className="flex items-center gap-3 text-left"
                    >
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-destructive shrink-0" />
                      )}
                      <span className="text-muted-foreground">
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant={(plan as any).isFeatured ? 'default' : 'outline'}
                  className={cn(
                    'w-full',
                    (plan as any).isFeatured &&
                      'bg-accent hover:bg-accent/90 text-accent-foreground'
                  )}
                  disabled={buttonDisabled}
                  onClick={() => handleCheckout(planId)}
                >
                  {buttonText}
                </Button>
              </CardFooter>
            </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
