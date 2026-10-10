// Shared, deliberately small content format. Never render uploaded HTML directly.
export const PACKAGE_LIMITS = { zip: 60 * 1024 * 1024, expanded: 100 * 1024 * 1024, extracted: 8 * 1024 * 1024, entries: 1000, lessons: 20, html: 250_000, image: 400_000, lesson: 750_000, request: 3_000_000 };
export const CONTENT_TAGS = ['p','div','h1','h2','h3','h4','ul','ol','li','strong','em','u','s','pre','code','blockquote','table','thead','tbody','tr','th','td','br','hr','a','img','sup','sub'] as const;
export type ContentTag = typeof CONTENT_TAGS[number];
export type ContentNode = { text: string } | { tag: ContentTag; children: ContentNode[]; href?: string; target?: string; src?: string; alt?: string };
export type PackageLesson = { key: string; title: string; nodes: ContentNode[]; interactiveHtml?: string };
export type LessonPackage = { lessons: PackageLesson[]; warnings: string[] };
export const byteLength = (value: string) => new TextEncoder().encode(value).length;
export function safeExternalLink(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function safeImage(value: string) {
  if (value.length > Math.ceil(PACKAGE_LIMITS.image * 4 / 3) + 40) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  try {
    const head = atob(match[2].slice(0, 32));
    return match[1] === 'png' ? head.startsWith('\x89PNG\r\n\x1a\n') :
      match[1] === 'jpeg' ? head.startsWith('\xff\xd8\xff') : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
  } catch { return false; }
}
export function validatePackage(input: unknown): LessonPackage {
  const data = input as LessonPackage;
  if (!data || !Array.isArray(data.lessons) || data.lessons.length < 1 || data.lessons.length > PACKAGE_LIMITS.lessons) throw new Error('INVALID_LESSONS');
  const keys = new Set<string>();
  for (const lesson of data.lessons) {
    if (!lesson || typeof lesson.key !== 'string' || !/^l\d{1,3}$/.test(lesson.key) || keys.has(lesson.key)) throw new Error('INVALID_LESSONS');
    keys.add(lesson.key);
  }
  const lessons = data.lessons.map(lesson => {
    if (typeof lesson.title !== 'string' || !lesson.title.trim() || lesson.title.length > 200) throw new Error('INVALID_TITLE');
    if (lesson.interactiveHtml !== undefined) {
      if (typeof lesson.interactiveHtml !== 'string' || !lesson.interactiveHtml.trim() || byteLength(lesson.interactiveHtml) > 650_000) throw new Error('CONTENT_TOO_LARGE');
      const clean: PackageLesson = {key: lesson.key, title: lesson.title.trim(), nodes: [], interactiveHtml: lesson.interactiveHtml};
      if (byteLength(JSON.stringify(clean)) > PACKAGE_LIMITS.lesson) throw new Error('CONTENT_TOO_LARGE');
      return clean;
    }
    let count = 0;
    function check(nodes: unknown, depth: number): ContentNode[] {
      if (!Array.isArray(nodes) || depth > 24) throw new Error('CONTENT_TOO_COMPLEX');
      return nodes.map((value: unknown): ContentNode => {
        if (++count > 5000 || !value || typeof value !== 'object') throw new Error('CONTENT_TOO_COMPLEX');
        const node = value as Record<string, unknown>;
        if (typeof node.text === 'string') {
          if (node.text.length > 100_000) throw new Error('CONTENT_TOO_LARGE');
          return { text: node.text };
        }
        if (!CONTENT_TAGS.includes(node.tag as ContentTag)) throw new Error('UNSAFE_CONTENT');
        const result: Exclude<ContentNode, {text: string}> = { tag: node.tag as ContentTag, children: check(node.children, depth + 1) };
        if (result.tag === 'img') {
          if (typeof node.src !== 'string' || !safeImage(node.src)) throw new Error('UNSAFE_IMAGE');
          result.src = node.src;
          result.alt = typeof node.alt === 'string' ? node.alt.slice(0, 300) : '';
        }
        if (result.tag === 'a') {
          if (typeof node.target === 'string') {
            if (!keys.has(node.target)) throw new Error('BROKEN_LESSON_LINK');
            result.target = node.target;
          } else if (typeof node.href === 'string') {
            const href = safeExternalLink(node.href);
            if (!href || href.length > 2000) throw new Error('UNSAFE_LINK');
            result.href = href;
          }
        }
        return result;
      });
    }
    const clean = {key: lesson.key, title: lesson.title.trim(), nodes: check(lesson.nodes, 0)};
    if (!clean.nodes.length || byteLength(JSON.stringify(clean)) > PACKAGE_LIMITS.lesson) throw new Error('CONTENT_TOO_LARGE');
    return clean;
  });
  if (byteLength(JSON.stringify(lessons)) > PACKAGE_LIMITS.request - 5000) throw new Error('PACKAGE_TOO_LARGE');
  return {lessons, warnings: []};
}
export function contentText(nodes: ContentNode[]): string {
  return nodes.map(node => 'text' in node ? node.text : node.tag === 'img' ? node.alt || '' : contentText(node.children) + (['p','div','li','h1','h2','h3','h4','br'].includes(node.tag) ? '\n' : '')).join('');
}
