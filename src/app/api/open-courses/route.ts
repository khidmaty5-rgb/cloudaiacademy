import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { getS3Client } from '@/lib/s3';
import { requireLectureAdmin, lectureBucket, requirePrivateLectureBucket, readBoundedBody } from '@/server/lecture-resources';
import { builtinCourse, interactivePackage, openCourseContent, openCourseError } from '@/server/open-courses';
import { courseMetadata, openCourseView, validOpenCourseId, OPEN_COURSE_REQUEST_LIMIT } from '@/lib/open-course-management';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
async function body(request: Request, limit: number) {
  try {
    const value = JSON.parse((await readBoundedBody(request, limit)).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REQUEST');
    return value;
  }
  catch (error) { if (error instanceof Error && error.message === 'FILE_TOO_LARGE') throw error; throw new Error('INVALID_REQUEST'); }
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const manage = url.searchParams.get('manage') === '1';
    if (manage) await requireLectureAdmin(request);
    const after = url.searchParams.get('after');
    if (after && !validOpenCourseId(after)) throw new Error('INVALID_REQUEST');
    const db = getFirebaseAdminFirestore(); const collection = db.collection('openCourses');
    let query = (manage ? collection : collection.where('published', '==', true)).orderBy(FieldPath.documentId()).limit(20);
    if (after) query = query.startAfter(after);
    const result = await query.get();
    const items = result.docs.map(doc => openCourseView(doc.id, doc.data() as typeof builtinCourse));
    // A saved override (including a withdrawn one) always suppresses the legacy fallback.
    if (!after && !(await db.doc('openCourses/number-systems').get()).exists) items.unshift(openCourseView('number-systems', builtinCourse));
    return Response.json({ items, next: result.size === 20 ? result.docs.at(-1)?.id : null }, { headers });
  } catch (error) { return openCourseError(error); }
}
export async function POST(request: Request) {
  try {
    const uid = await requireLectureAdmin(request); const data = await body(request, OPEN_COURSE_REQUEST_LIMIT);
    const metadata = courseMetadata(data.metadata); const pkg = interactivePackage(data.package);
    const id = randomUUID(); const bucket = lectureBucket(); const key = `open-courses/${id}.json`;
    await requirePrivateLectureBucket(bucket);
    await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(pkg), ContentType: 'application/json' }));
    try { await getFirebaseAdminFirestore().doc(`openCourses/${id}`).create({ ...metadata, published: false, revision: 1, createdBy: uid, createdAt: new Date().toISOString() }); }
    catch (error) { await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined); throw error; }
    return Response.json({ id }, { status: 201, headers });
  } catch (error) { return openCourseError(error); }
}
export async function PATCH(request: Request) {
  try {
    const uid = await requireLectureAdmin(request); const data = await body(request, 100_000);
    if (!validOpenCourseId(data.id || '') || !Number.isInteger(data.revision) || data.revision < 0 ||
      (data.metadata === undefined && data.published === undefined) || (data.published !== undefined && typeof data.published !== 'boolean')) throw new Error('INVALID_REQUEST');
    const metadata = data.metadata === undefined ? undefined : courseMetadata(data.metadata);
    if (data.published === true) await openCourseContent(data.id);
    const db = getFirebaseAdminFirestore(); const ref = db.doc(`openCourses/${data.id}`);
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref); const current = doc.exists ? doc.data()! : data.id === 'number-systems' ? builtinCourse : null;
      if (!current) throw new Error('NOT_FOUND');
      if (current.revision !== data.revision) throw new Error('CONFLICT');
      tx.set(ref, { ...current, ...metadata, published: data.published ?? current.published, revision: current.revision + 1, updatedBy: uid, updatedAt: new Date().toISOString() });
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) { return openCourseError(error); }
}
