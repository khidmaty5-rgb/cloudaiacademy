import type { Course } from '@/types/models';
import { PlaceHolderImages, getPlaceholderImage } from '@/lib/placeholder-images';

function normalizeText(v: unknown): string {
  return String(v ?? '').toLowerCase();
}

export type CourseImageFit = 'cover' | 'contain';

export function inferCourseImageId(course: Partial<Course> | null | undefined): string | undefined {
  const title = normalizeText((course as any)?.title);
  const category = normalizeText((course as any)?.category);
  const slug = normalizeText((course as any)?.slug);

  // Prefer slug-based routing (more deterministic)
  if (slug.includes('n8n')) return 'course-n8n';
  if (slug.includes('agile') || slug.includes('scrum')) return 'course-agile';
  if (slug.includes('devops') || slug.includes('cicd') || slug.includes('ci-cd')) return 'course-devops';
  if (slug.includes('cloud')) return 'course-cloud';
  if (slug.includes('python-for-data') || (slug.includes('data') && slug.includes('python'))) return 'course-python-data';
  if (slug.includes('power-bi') || slug.includes('pbi')) return 'course-power-bi';
  if (slug.includes('sql')) return 'course-sql';
  if (slug.includes('excel')) return 'course-excel';
  if (slug.includes('linux')) return 'course-linux';
  if (slug.includes('cyber') || slug.includes('security')) return 'course-cyber';
  if (slug.includes('network')) return 'course-networking';
  if (slug.includes('maintenance')) return 'course-maintenance';
  if (slug.includes('helpdesk') || slug.includes('support')) return 'course-service-desk';
  if (slug.includes('customer-service') || slug.includes('call-center')) return 'course-customer-service';
  if (slug.includes('communication')) return 'course-communication';
  if (slug.includes('digital-skills')) return 'course-digital-skills';
  if (slug.includes('business-intelligence')) return 'course-bi';
  if (slug.includes('full-stack')) return 'course-full-stack';
  if (slug.includes('azure-ai')) return 'course-azure';
  if (slug.includes('machine-learning') || slug.includes('ml')) return 'course-ml';
  if (slug.includes('aws-solutions-architect') || slug.includes('aws-sa') || slug.includes('aws-')) return 'course-aws';

  // Fallback to title/category heuristics
  if (title.includes('n8n')) return 'course-n8n';
  if (title.includes('agile') || title.includes('scrum')) return 'course-agile';
  if (title.includes('devops') || title.includes('ci/cd') || title.includes('git')) return 'course-devops';
  if (title.includes('cloud') || category.includes('cloud')) return 'course-cloud';
  if (title.includes('python for data analysis') || (title.includes('data analysis') && title.includes('python'))) return 'course-python-data';
  if (title.includes('power bi')) return 'course-power-bi';
  if (title.includes(' sql') || title.startsWith('sql') || category.includes('sql')) return 'course-sql';
  if (title.includes('excel')) return 'course-excel';
  if (title.includes('linux')) return 'course-linux';
  if (title.includes('cyber') || title.includes('security')) return 'course-cyber';
  if (title.includes('network')) return 'course-networking';
  if (title.includes('maintenance')) return 'course-maintenance';
  if (title.includes('helpdesk') || title.includes('support')) return 'course-service-desk';
  if (title.includes('customer service') || title.includes('call center')) return 'course-customer-service';
  if (title.includes('communication')) return 'course-communication';
  if (title.includes('digital skills')) return 'course-digital-skills';
  if (title.includes('business intelligence')) return 'course-bi';
  if (title.includes('python')) return 'course-python';
  if (title.includes('full stack')) return 'course-full-stack';
  if (title.includes('azure ai')) return 'course-azure';
  if (title.includes('machine learning')) return 'course-ml';
  if (title.includes('aws solutions architect') || title.includes('aws ')) return 'course-aws';

  return undefined;
}

function isKnownPlaceholderId(id: unknown): id is string {
  return typeof id === 'string' && PlaceHolderImages.some((img) => img.id === id);
}

export function chooseCourseImageId(course: Partial<Course> | null | undefined): string | undefined {
  const provided = (course as any)?.imageId as string | undefined;
  if (isKnownPlaceholderId(provided)) return provided;
  const inferred = inferCourseImageId(course);
  return inferred || provided;
}

function normalizeFit(v: unknown): CourseImageFit | null {
  return v === 'contain' ? 'contain' : v === 'cover' ? 'cover' : null;
}

function inferFitFromSrc(src: string): CourseImageFit {
  const s = (src || '').toLowerCase();
  if (!s) return 'cover';
  if (s.endsWith('.svg')) return 'contain';

  // Heuristics: treat obvious logos/placeholders as "contain" to avoid cropping.
  // You can override per-course later by adding `imageFit: 'cover' | 'contain'` in the course document.
  const containMarkers = [
    '/images/logo',
    '/images/logow',
    '/images/log1o',
    '/images/hero-browser',
    'certificatelog',
    '/signature',
  ];
  if (containMarkers.some((m) => s.includes(m))) return 'contain';

  return 'cover';
}

export function getCourseImage(
  course: Partial<Course> | null | undefined,
): { src: string; hint: string; fit: CourseImageFit } {
  const explicitUrlRaw = (course as any)?.imageUrl as string | undefined;
  const explicitUrl = typeof explicitUrlRaw === 'string' ? explicitUrlRaw.trim() : '';
  const fitOverride = normalizeFit((course as any)?.imageFit);
  if (explicitUrl) {
    return {
      src: explicitUrl,
      hint: 'course image',
      fit: fitOverride || inferFitFromSrc(explicitUrl),
    };
  }

  const placeholder = getPlaceholderImage(chooseCourseImageId(course));
  return {
    src: placeholder.imageUrl,
    hint: placeholder.imageHint,
    fit: fitOverride || inferFitFromSrc(placeholder.imageUrl),
  };
}
