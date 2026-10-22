import type { Course } from '@/types/models';

export type LearningPlanInput = {
  interests: string;
  careerGoals: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  language: 'English' | 'Arabic';
};
export type CourseLearningPlan = {
  title: string;
  description: string;
  courses: Pick<Course, 'id' | 'slug' | 'title' | 'level' | 'price'>[];
};

const normalize = (value: string) => value.toLowerCase().normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
const words = (value: string) => normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
const ignored = new Set(words('a an the and or in for to of with become learn learning course courses career engineer developer applications my want I مهندس تعلم التعلم دورة دورات في من الي اريد ان مع و'));
// Small, explicit bilingual topic dictionary—not an AI model or a translation service.
const topics = [
  ['cybersecurity', 'security', 'cyber', 'الامن', 'امن', 'السيبراني', 'سيبراني'],
  ['network', 'networks', 'networking', 'شبكات', 'الشبكات', 'الشبكة', 'شبكة'],
  ['cloud', 'aws', 'azure', 'السحابة', 'السحابية', 'سحابة'],
  ['ai', 'artificial', 'intelligence', 'الذكاء', 'الاصطناعي'],
  ['machine', 'ml', 'الالة', 'الآلي'],
  ['data', 'analytics', 'بيانات', 'البيانات', 'تحليل', 'التحليل'],
  ['programming', 'coding', 'برمجة', 'البرمجة'],
  ['automation', 'n8n', 'اتمتة', 'الاتمتة'],
  ['devops', 'ديفوبس'],
].map(group => new Set(group.flatMap(words)));

function terms(value: string) {
  const tokens = new Set(words(value).filter(word => word.length > 1 && !ignored.has(word)));
  for (const group of topics) {
    if ([...group].some(word => tokens.has(word))) for (const word of group) tokens.add(word);
  }
  return tokens;
}

export function buildCourseLearningPlan(input: LearningPlanInput, catalog: readonly Course[]): CourseLearningPlan {
  const interests = input.interests.trim();
  const goals = input.careerGoals.trim();
  const levels = { beginner: 0, intermediate: 1, advanced: 2 };
  if (!interests || !goals || interests.length > 300 || goals.length > 1000 ||
      !(input.experienceLevel in levels) || !['English', 'Arabic'].includes(input.language)) {
    throw new Error('INVALID_PLAN_INPUT');
  }
  const desired = terms(`${interests} ${goals}`);
  const seen = new Set<string>();
  const courses = catalog.filter(course => {
    if (course.status !== 'PUBLISHED' || !course.id || !course.slug || seen.has(course.id)) return false;
    seen.add(course.id);
    return true;
  }).map(course => {
    const level = levels[course.level?.toLowerCase() as keyof typeof levels];
    const prominent = terms(`${course.title} ${course.category}`);
    const description = terms(course.description || '');
    const score = [...desired].reduce((sum, term) =>
      sum + (prominent.has(term) ? 3 : description.has(term) ? 1 : 0), 0);
    return { course, level, score };
  }).filter(item => item.score > 0 && item.level !== undefined && item.level <= levels[input.experienceLevel])
    .sort((a, b) => a.level - b.level || b.score - a.score || a.course.id.localeCompare(b.course.id))
    .slice(0, 5).map(({ course }) => ({
      id: course.id, slug: course.slug, title: course.title,
      level: course.level, price: course.price || '',
    }));
  const ar = input.language === 'Arabic';
  const title = ar ? `مسار دورات: ${interests}` : `Course plan: ${interests}`;
  const intro = ar
    ? `خطة مبنية على مطابقة الكلمات والموضوعات في دورات الأكاديمية المنشورة، وليست مولّدة بالذكاء الاصطناعي.\nهدفك: ${goals}`
    : `A keyword- and topic-matched plan from published Academy courses, not AI-generated.\nYour goal: ${goals}`;
  const details = courses.length
    ? courses.map((course, index) => `${index + 1}. ${course.title}`).join('\n')
    : ar ? 'لا توجد دورات مطابقة لموضوعك ومستواك حاليًا. جرّب موضوعًا أوسع أو تصفّح الدورات.'
      : 'No courses currently match your topic and level. Try a broader topic or browse courses.';
  const note = ar
    ? 'هذه نقطة بداية وليست منهجًا شاملًا أو ضمانًا لتحقيق الهدف المهني. أسماء الدورات بلغتها الأصلية. قد تتطلب الدورات رسومًا؛ إنشاء الخطة مجاني.'
    : 'This is a starting point, not a complete curriculum or a guarantee of career outcomes. Course titles retain their original language. Courses may have fees; creating this plan is free.';
  return { title, description: `${intro}\n\n${details}\n\n${note}`, courses };
}
