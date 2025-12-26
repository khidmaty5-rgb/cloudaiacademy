'use client';

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
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { DEFAULT_PRICING, sanitizePricingConfig } from '@/lib/landing-pricing';

// plans are derived inside the component based on language

export default function Pricing() {
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
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
  if (!showPricing) return null;

  const config = sanitizePricingConfig(ui?.pricing?.[lang], DEFAULT_PRICING[lang]);
  const resolvedHeading = config.heading || heading;
  const resolvedSub = config.sub || sub;
  const resolvedPeriod = config.period || period;
  const resolvedMostPopular = config.mostPopular || mostPopular;
  const resolvedButtonText = config.buttonText || btnText;
  const resolvedPlans = config.plans.length > 0 ? config.plans : plans;

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
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
          {resolvedPlans.map((plan) => (
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
                >
                  {resolvedButtonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
