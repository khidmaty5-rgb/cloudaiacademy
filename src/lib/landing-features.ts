import type { SupportedLang } from '@/lib/landing-pricing';

export type FeatureIconId = 'laptop' | 'graduationCap' | 'award';

export type FeatureItem = {
  id: string;
  icon: FeatureIconId;
  title: string;
  description: string;
};

export type FeaturesConfig = {
  heading: string;
  sub: string;
  items: FeatureItem[];
};

export const DEFAULT_FEATURES: Record<SupportedLang, FeaturesConfig> = {
  en: {
    heading: 'Why Choose CloudAI Academy?',
    sub: "We provide the most comprehensive learning experience for tomorrow's top cloud and AI professionals.",
    items: [
      {
        id: 'hands-on',
        icon: 'laptop',
        title: 'Hands-on Learning',
        description: 'Gain practical experience with real-world projects and cloud environments.',
      },
      {
        id: 'experts',
        icon: 'graduationCap',
        title: 'Expert Instructors',
        description: 'Learn from industry professionals with years of experience in cloud and AI.',
      },
      {
        id: 'certifications',
        icon: 'award',
        title: 'Industry Certifications',
        description: 'Prepare for AWS, Azure, Google Cloud, and other industry certifications.',
      },
    ],
  },
  ar: {
    heading: 'لماذا تختار CloudAI Academy؟',
    sub: 'نقدّم تجربة تعلّم شاملة لإعداد محترفي السحابة والذكاء الاصطناعي للمستقبل.',
    items: [
      {
        id: 'hands-on',
        icon: 'laptop',
        title: 'تعلّم عملي',
        description: 'اكتسب خبرة عملية عبر مشاريع واقعية وبيئات سحابية.',
      },
      {
        id: 'experts',
        icon: 'graduationCap',
        title: 'مدربون خبراء',
        description: 'تعلّم من خبراء لديهم سنوات من الخبرة في السحابة والذكاء الاصطناعي.',
      },
      {
        id: 'certifications',
        icon: 'award',
        title: 'شهادات احترافية',
        description: 'استعد لشهادات AWS وAzure وGoogle Cloud وغيرها من الشهادات المعتمدة.',
      },
    ],
  },
};

function isIcon(value: unknown): value is FeatureIconId {
  return value === 'laptop' || value === 'graduationCap' || value === 'award';
}

function sanitizeItem(value: unknown, fallback: FeatureItem): FeatureItem {
  const raw = value as any;
  const id = typeof raw?.id === 'string' ? raw.id : fallback.id;
  const icon = isIcon(raw?.icon) ? raw.icon : fallback.icon;
  const title = typeof raw?.title === 'string' ? raw.title : fallback.title;
  const description =
    typeof raw?.description === 'string' ? raw.description : fallback.description;
  return {
    id: id.trim() || fallback.id,
    icon,
    title: title.trim() || fallback.title,
    description: description.trim() || fallback.description,
  };
}

export function sanitizeFeaturesConfig(input: unknown, fallback: FeaturesConfig): FeaturesConfig {
  const raw = input as any;
  const heading = typeof raw?.heading === 'string' ? raw.heading : fallback.heading;
  const sub = typeof raw?.sub === 'string' ? raw.sub : fallback.sub;

  const rawItems: unknown[] = Array.isArray(raw?.items) ? raw.items : [];
  const fallbackItems = fallback.items || [];
  const items =
    rawItems.length > 0
      ? rawItems
          .slice(0, 8)
          .map((item, index) => sanitizeItem(item, fallbackItems[index] ?? fallbackItems[0]))
      : fallbackItems;

  return {
    heading: heading.trim() || fallback.heading,
    sub: sub.trim() || fallback.sub,
    items: items.filter(Boolean).slice(0, 8),
  };
}

