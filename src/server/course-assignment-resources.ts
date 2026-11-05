import 'server-only';
import { openCourseRecord } from '@/server/open-courses';
import { lectureIdValid } from '@/lib/lecture-resources';

// Separate namespace: assignment instructions never contain student answers.
export async function resourceScope(request: Request, manage: boolean) {
  const courseId = new URL(request.url).searchParams.get('courseId');
  if (!courseId) return { collection: 'lectureResources', prefix: 'lecture-resources' };
  if (courseId !== 'number-systems' && !lectureIdValid(courseId)) throw new Error('NOT_FOUND');
  const course = await openCourseRecord(courseId);
  if (!manage && !course.published) throw new Error('NOT_FOUND');
  return { collection: `courseAssignmentResources/${courseId}/items`, prefix: `course-assignments/${courseId}` };
}
