import type { SupportedLang } from '@/lib/landing-pricing';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqConfig = {
  heading: string;
  sub: string;
  items: FaqItem[];
};

export const DEFAULT_FAQ: Record<SupportedLang, FaqConfig> = {
  en: {
    heading: 'Frequently Asked Questions',
    sub: 'Find answers to common questions about our platform.',
    items: [
      {
        id: 'trial',
        question: 'Do you offer a free trial?',
        answer:
          "Yes, we offer a 7-day free trial for all new students. You'll get access to our introductory courses and can explore the platform before committing to a paid plan.",
      },
      {
        id: 'pace',
        question: "What if I can't keep up with the course pace?",
        answer:
          "All our courses are self-paced, so you can learn at your own speed. You'll have lifetime access to course materials once you enroll.",
      },
      {
        id: 'employers',
        question: 'Are the certificates recognized by employers?',
        answer:
          'Yes, our certificates are recognized by industry partners and employers. We also prepare you for official certifications from AWS, Microsoft, and Google.',
      },
      {
        id: 'support',
        question: 'What kind of support do you offer?',
        answer:
          'We offer community support for all students, priority support for Pro plan subscribers, and 1-on-1 mentoring for Enterprise plan subscribers.',
      },
    ],
  },
  ar: {
    heading: 'الأسئلة الشائعة',
    sub: 'اعثر على إجابات لأكثر الأسئلة شيوعاً حول منصتنا.',
    items: [
      {
        id: 'trial',
        question: 'هل تقدمون تجربة مجانية؟',
        answer:
          'نعم، نقدم تجربة مجانية لمدة 7 أيام لجميع الطلاب الجدد. ستحصل على وصول إلى الدورات التمهيدية ويمكنك استكشاف المنصة قبل الاشتراك.',
      },
      {
        id: 'pace',
        question: 'ماذا لو لم أستطع مجاراة وتيرة التعلم؟',
        answer:
          'جميع دوراتنا ذاتية الوتيرة، ويمكنك التعلم بالسرعة التي تناسبك. ستحصل على وصول دائم إلى مواد الدورة بعد التسجيل.',
      },
      {
        id: 'employers',
        question: 'هل شهاداتكم معترف بها لدى أصحاب العمل؟',
        answer:
          'نعم، شهاداتنا معترف بها من شركائنا في الصناعة وأصحاب العمل. كما نؤهلك للحصول على شهادات رسمية من AWS و Microsoft و Google.',
      },
      {
        id: 'support',
        question: 'ما نوع الدعم الذي تقدمونه؟',
        answer:
          'نقدم دعم المجتمع لجميع الطلاب، ودعماً أولوية لمشتركي خطة احترافي، وإرشاداً فردياً 1-1 لمشتركي خطة مؤسسي.',
      },
    ],
  },
};

export function sanitizeFaqConfig(input: unknown, fallback: FaqConfig): FaqConfig {
  const raw = input as any;

  const heading = typeof raw?.heading === 'string' ? raw.heading : fallback.heading;
  const sub = typeof raw?.sub === 'string' ? raw.sub : fallback.sub;

  const rawItems = Array.isArray(raw?.items) ? raw.items : fallback.items;
  const items: FaqItem[] = rawItems
    .map((item: any, index: number) => {
      const fb = fallback.items[index];
      const id =
        typeof item?.id === 'string' && item.id.trim()
          ? item.id.trim()
          : fb?.id ?? `faq-${index + 1}`;
      const question =
        typeof item?.question === 'string' ? item.question : fb?.question ?? '';
      const answer = typeof item?.answer === 'string' ? item.answer : fb?.answer ?? '';
      return { id, question, answer };
    })
    .filter((it: FaqItem) => it.question.trim().length > 0 && it.answer.trim().length > 0);

  return { heading, sub, items };
}

