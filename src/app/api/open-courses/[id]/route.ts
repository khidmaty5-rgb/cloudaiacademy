import { requireLectureAdmin } from '@/server/lecture-resources';
import { openCourseRecord, openCourseContent, openCourseError } from '@/server/open-courses';
import { openCourseView } from '@/lib/open-course-management';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const preview = new URL(request.url).searchParams.get('preview') === '1';
    if (preview) await requireLectureAdmin(request);
    const record = await openCourseRecord(id);
    if (!record.published && !preview) throw new Error('NOT_FOUND');
    const pkg = await openCourseContent(id);
    // Check again after storage retrieval to avoid serving a concurrently withdrawn course.
    const latest = await openCourseRecord(id);
    if (!latest.published && !preview) throw new Error('NOT_FOUND');
    return Response.json({ course: openCourseView(id, latest), package: pkg }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return openCourseError(error); }
}
