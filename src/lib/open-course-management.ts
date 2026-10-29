import { safeImage } from './lesson-package';
import type { OpenCourse } from './open-courses';

export const OPEN_COURSE_REQUEST_LIMIT = 3_000_000;
export type CourseMetadata = {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  language: 'ar' | 'en' | 'both';
  minutes: number;
  image: string;
};
export type ManagedOpenCourse = OpenCourse & CourseMetadata & { revision: number };
export const validOpenCourseId = (id: string) => id === 'number-systems' || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function courseMetadata(input: unknown): CourseMetadata {
  const x = input as CourseMetadata;
  const text = (value: unknown, max: number, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('INVALID_METADATA');
    return value.trim();
  };
  if (!x || !['ar', 'en', 'both'].includes(x.language) || !Number.isInteger(x.minutes) || x.minutes < 1 || x.minutes > 10000) throw new Error('INVALID_METADATA');
  const title = { en: text(x.title?.en, 160, true), ar: text(x.title?.ar, 160) };
  const description = { en: text(x.description?.en, 1000), ar: text(x.description?.ar, 1000) };
  const image = text(x.image, 80_000);
  if (image && !safeImage(image)) throw new Error('INVALID_METADATA');
  return { title, description, language: x.language, minutes: x.minutes, image };
}
export function openCourseView(id: string, data: CourseMetadata & { published: boolean; revision: number }): ManagedOpenCourse {
  const m = courseMetadata(data);
  return { ...m, title: { en: m.title.en, ar: m.title.ar || m.title.en },
    description: { en: m.description.en, ar: m.description.ar || m.description.en },
    id, href: '/open-courses/' + id, access: 'open', published: data.published === true, revision: data.revision,
    details: { en: `${{ ar: 'Arabic', en: 'English', both: 'Arabic & English' }[m.language]} · ${m.minutes} minutes`,
      ar: `${{ ar: 'العربية', en: 'الإنجليزية', both: 'العربية والإنجليزية' }[m.language]} · ${m.minutes} دقيقة` } };
}
