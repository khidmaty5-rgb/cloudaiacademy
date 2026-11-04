import type { ManagedOpenCourse } from './open-course-management';

// Admin filters (active/Trash) must operate on the complete catalogue, not
// only the first storage page, which may contain nothing but tombstones.
export async function loadOpenCourseList(fetchPage: (after?: string) => Promise<{ items: ManagedOpenCourse[]; next: string | null }>) {
  const items = new Map<string, ManagedOpenCourse>();
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await fetchPage(cursor);
    if (!Array.isArray(result.items) || (result.next !== null && typeof result.next !== 'string')) throw new Error('LOAD_FAILED');
    for (const item of result.items) items.set(item.id, item);
    if (result.next === null) return [...items.values()];
    if (!result.next || seen.has(result.next)) throw new Error('LOAD_FAILED');
    seen.add(result.next); cursor = result.next;
  }
  // Never silently return an incomplete list or loop forever on a bad cursor.
  throw new Error('LOAD_FAILED');
}
