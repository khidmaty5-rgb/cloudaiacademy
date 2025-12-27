import type { SupportedLang } from '@/lib/landing-pricing';

export type HeroConfig = {
  title: string;
  desc: string;
  explore: string;
  dashboard: string;
  trial: string;
  badge: string;
  highlights: string[];
};

export const DEFAULT_HERO: Record<SupportedLang, HeroConfig> = {
  en: {
    title: 'Unlock Your Potential in Cloud & AI',
    desc:
      "Join thousands of professionals advancing their careers with our industry-leading courses and hands-on projects.",
    explore: 'Explore Courses',
    dashboard: 'Go to Dashboard',
    trial: 'Create Free Account',
    badge: 'Cohorts starting soon',
    highlights: ['Hands-on labs', 'Printable certificates', 'Arabic & English'],
  },
  ar: {
    title: 'أطلق إمكاناتك في الحوسبة السحابية والذكاء الاصطناعي',
    desc:
      'انضم إلى آلاف المهنيين الذين يطوّرون مسيرتهم عبر دوراتنا الرائدة ومشاريع تطبيقية.',
    explore: 'استكشف الدورات',
    dashboard: 'اذهب إلى لوحة التحكم',
    trial: 'إنشاء حساب مجاني',
    badge: 'دفعات تبدأ قريباً',
    highlights: ['مختبرات عملية', 'شهادات قابلة للطباعة', 'العربية والإنجليزية'],
  },
};

export function sanitizeHeroConfig(input: unknown, fallback: HeroConfig): HeroConfig {
  const raw = input as any;
  const title = typeof raw?.title === 'string' ? raw.title : fallback.title;
  const desc = typeof raw?.desc === 'string' ? raw.desc : fallback.desc;
  const explore = typeof raw?.explore === 'string' ? raw.explore : fallback.explore;
  const dashboard =
    typeof raw?.dashboard === 'string' ? raw.dashboard : fallback.dashboard;
  const trial = typeof raw?.trial === 'string' ? raw.trial : fallback.trial;
  const badge = typeof raw?.badge === 'string' ? raw.badge : fallback.badge;

  const rawHighlights = Array.isArray(raw?.highlights) ? raw.highlights : fallback.highlights;
  const highlights = rawHighlights
    .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, 8);

  return { title, desc, explore, dashboard, trial, badge, highlights };
}

