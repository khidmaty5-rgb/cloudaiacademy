// Explicitly reviewed, anonymous-access courses. A zero price never implies
// anonymous access. Publishing here also requires a public page/route policy.
type Copy = { en: string; ar: string };
export type OpenCourse = {
  id: string;
  href: string;
  published: boolean;
  access: 'open' | 'registration';
  title: Copy;
  description: Copy;
  details: Copy;
};

export const openCourseCatalog: readonly OpenCourse[] = [
  {
    id: 'number-systems',
    href: '/open-courses/number-systems',
    published: true,
    access: 'open',
    title: { en: 'Number Systems — الأنظمة العددية', ar: 'الأنظمة العددية' },
    description: {
      en: 'Learn binary, octal, decimal and hexadecimal with a conversion lab and an interactive quiz.',
      ar: 'تعلّم الثنائي والثماني والعشري والسادس عشر مع مختبر تحويل واختبار تفاعلي.',
    },
    details: { en: 'Arabic · Beginner · 90 minutes', ar: 'بالعربية · مبتدئ · 90 دقيقة' },
  },
];

export function publishedOpenCourses(courses: readonly OpenCourse[] = openCourseCatalog) {
  return courses.filter(course => course.published && course.access === 'open');
}
