import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { lectureBucket } from '@/server/lecture-resources';
import { courseMetadata, OPEN_COURSE_REQUEST_LIMIT, validOpenCourseId } from '@/lib/open-course-management';
import { validatePackage } from '@/lib/lesson-package';
import { openCourseCatalog } from '@/lib/open-courses';
import builtinLesson from '@/content/number-systems.json';

export const builtinCourse = { ...courseMetadata({ ...openCourseCatalog[0], language: 'ar', minutes: 90, image: '' }), published: true, revision: 0 };
export async function openCourseRecord(id: string) {
  if (!validOpenCourseId(id)) throw new Error('NOT_FOUND');
  const doc = await getFirebaseAdminFirestore().doc(`openCourses/${id}`).get();
  if (doc.exists) return doc.data() as typeof builtinCourse;
  if (id === 'number-systems') return builtinCourse;
  throw new Error('NOT_FOUND');
}
export function interactivePackage(value: unknown) {
  try {
    const pkg = validatePackage(value);
    if (pkg.lessons.some(lesson => !lesson.interactiveHtml)) throw new Error('INVALID_PACKAGE');
    if (Buffer.byteLength(JSON.stringify(pkg)) > OPEN_COURSE_REQUEST_LIMIT - 100_000) throw new Error('FILE_TOO_LARGE');
    return pkg;
  } catch { throw new Error('INVALID_PACKAGE'); }
}
export async function openCourseContent(id: string) {
  if (!validOpenCourseId(id)) throw new Error('NOT_FOUND');
  if (id === 'number-systems') return interactivePackage({ lessons: [{ key: 'l0', title: 'الأنظمة العددية', nodes: [], interactiveHtml: builtinLesson.html }] });
  const result = await getS3Client().send(new GetObjectCommand({ Bucket: lectureBucket(), Key: `open-courses/${id}.json` }));
  if (!result.Body || (result.ContentLength || 0) > OPEN_COURSE_REQUEST_LIMIT) throw new Error('CONTENT_UNAVAILABLE');
  const reader = result.Body.transformToWebStream().getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > OPEN_COURSE_REQUEST_LIMIT) { await reader.cancel(); throw new Error('CONTENT_UNAVAILABLE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return interactivePackage(JSON.parse(Buffer.concat(chunks).toString()));
}
export function openCourseError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : code === 'FILE_TOO_LARGE' ? 413 : ['INVALID_METADATA', 'INVALID_PACKAGE', 'INVALID_REQUEST'].includes(code) ? 400 : 503;
  return Response.json({ error: status === 503 && code !== 'STORAGE_PRIVACY_UNVERIFIED' ? 'COURSE_UNAVAILABLE' : code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
