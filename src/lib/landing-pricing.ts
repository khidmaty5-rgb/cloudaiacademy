export type SupportedLang = 'en' | 'ar';

export type PricingFeature = {
  text: string;
  included: boolean;
};

export type PricingPlan = {
  id: string;
  name: string;
  price: string;
  isFeatured?: boolean;
  features: PricingFeature[];
};

export type PricingConfig = {
  heading: string;
  sub: string;
  period: string;
  mostPopular: string;
  buttonText: string;
  plans: PricingPlan[];
};

export const DEFAULT_PRICING: Record<SupportedLang, PricingConfig> = {
  en: {
    heading: 'Flexible Learning Plans',
    sub: 'Choose the plan that works best for your learning journey.',
    period: 'per month',
    mostPopular: 'Most Popular',
    buttonText: 'Get Started',
    plans: [
      {
        id: 'basic',
        name: 'Basic',
        price: '$29',
        isFeatured: false,
        features: [
          { text: 'Access to 50+ courses', included: true },
          { text: 'Community support', included: true },
          { text: 'Weekly challenges', included: true },
          { text: 'Certificate of completion', included: false },
          { text: '1-on-1 mentoring', included: false },
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$79',
        isFeatured: true,
        features: [
          { text: 'Access to all courses', included: true },
          { text: 'Priority support', included: true },
          { text: 'Real-world projects', included: true },
          { text: 'Certificate of completion', included: true },
          { text: '1-on-1 mentoring', included: false },
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: '$149',
        isFeatured: false,
        features: [
          { text: 'Access to all courses', included: true },
          { text: '24/7 premium support', included: true },
          { text: 'Real-world projects', included: true },
          { text: 'Certificate of completion', included: true },
          { text: 'Weekly 1-on-1 mentoring', included: true },
        ],
      },
    ],
  },
  ar: {
    heading: 'خطط تعلم مرنة',
    sub: 'اختر الخطة الأنسب لرحلتك التعليمية.',
    period: 'شهرياً',
    mostPopular: 'الأكثر شيوعاً',
    buttonText: 'ابدأ الآن',
    plans: [
      {
        id: 'basic',
        name: 'أساسي',
        price: '$29',
        isFeatured: false,
        features: [
          { text: 'وصول إلى أكثر من 50 دورة', included: true },
          { text: 'دعم المجتمع', included: true },
          { text: 'تحديات أسبوعية', included: true },
          { text: 'شهادة إتمام', included: false },
          { text: 'إرشاد فردي 1-1', included: false },
        ],
      },
      {
        id: 'pro',
        name: 'احترافي',
        price: '$79',
        isFeatured: true,
        features: [
          { text: 'وصول إلى جميع الدورات', included: true },
          { text: 'دعم أولوية', included: true },
          { text: 'مشاريع واقعية', included: true },
          { text: 'شهادة إتمام', included: true },
          { text: 'إرشاد فردي 1-1', included: false },
        ],
      },
      {
        id: 'enterprise',
        name: 'مؤسسي',
        price: '$149',
        isFeatured: false,
        features: [
          { text: 'وصول إلى جميع الدورات', included: true },
          { text: 'دعم متميز على مدار الساعة', included: true },
          { text: 'مشاريع واقعية', included: true },
          { text: 'شهادة إتمام', included: true },
          { text: 'إرشاد أسبوعي 1-1', included: true },
        ],
      },
    ],
  },
};

export function sanitizePricingConfig(
  input: unknown,
  fallback: PricingConfig
): PricingConfig {
  const raw = input as any;
  const heading = typeof raw?.heading === 'string' ? raw.heading : fallback.heading;
  const sub = typeof raw?.sub === 'string' ? raw.sub : fallback.sub;
  const period = typeof raw?.period === 'string' ? raw.period : fallback.period;
  const mostPopular =
    typeof raw?.mostPopular === 'string' ? raw.mostPopular : fallback.mostPopular;
  const buttonText =
    typeof raw?.buttonText === 'string' ? raw.buttonText : fallback.buttonText;

  const rawPlans = Array.isArray(raw?.plans) ? raw.plans : fallback.plans;
  const plans: PricingPlan[] = rawPlans
    .map((plan: any, index: number) => {
      const fb = fallback.plans[index];
      const id =
        typeof plan?.id === 'string' && plan.id.trim()
          ? plan.id.trim()
          : fb?.id ?? `plan-${index + 1}`;
      const name = typeof plan?.name === 'string' ? plan.name : fb?.name ?? '';
      const price = typeof plan?.price === 'string' ? plan.price : fb?.price ?? '';
      const isFeatured =
        typeof plan?.isFeatured === 'boolean' ? plan.isFeatured : fb?.isFeatured ?? false;

      const rawFeatures = Array.isArray(plan?.features)
        ? plan.features
        : fb?.features ?? [];
      const features: PricingFeature[] = rawFeatures
        .map((feature: any, featureIndex: number) => {
          const fbFeature = fb?.features?.[featureIndex];
          const text =
            typeof feature?.text === 'string'
              ? feature.text
              : fbFeature?.text ?? '';
          const included =
            typeof feature?.included === 'boolean'
              ? feature.included
              : fbFeature?.included ?? true;
          return { text, included };
        })
        .filter((f: PricingFeature) => f.text.trim().length > 0);

      return { id, name, price, isFeatured, features };
    })
    .filter((p: PricingPlan) => p.name.trim().length > 0 || p.features.length > 0);

  return { heading, sub, period, mostPopular, buttonText, plans };
}

