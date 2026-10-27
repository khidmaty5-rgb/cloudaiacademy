import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { getS3Client } from '@/lib/s3';
import { lectureIdValid, lectureMetadata, MAX_LECTURE_PDF_BYTES, publicLecture } from '@/lib/lecture-resources';
import { requireLectureAdmin, lectureBucket, requirePrivateLectureBucket, readBoundedBody, validateLecturePdf, lectureError } from '@/server/lecture-resources';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const manage = url.searchParams.get('manage') === '1';
    if (manage) await requireLectureAdmin(request);
    const cursor = url.searchParams.get('after');
    if (cursor && !lectureIdValid(cursor)) throw new Error('INVALID_REQUEST');
    const collection = getFirebaseAdminFirestore().collection('lectureResources');
    let query = (manage ? collection : collection.where('published', '==', true)).orderBy(FieldPath.documentId()).limit(25);
    if (cursor) query = query.startAfter(cursor);
    const result = await query.get();
    return Response.json({ items: result.docs.map(doc => publicLecture(doc.id, doc.data())), next: result.size === 25 ? result.docs.at(-1)?.id : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return lectureError(error); }
}

export async function POST(request: Request) {
  try {
    const uid = await requireLectureAdmin(request);
    const body = await readBoundedBody(request, MAX_LECTURE_PDF_BYTES + 16384);
    const form = await new Response(body, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    const metadata = lectureMetadata({ title: form.get('title'), topic: form.get('topic'), description: form.get('description') });
    const file = form.get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('INVALID_PDF');
    const bytes = new Uint8Array(await file.arrayBuffer()); await validateLecturePdf(bytes);
    const id = randomUUID(); const key = `lecture-resources/${id}.pdf`; const bucket = lectureBucket();
    await requirePrivateLectureBucket(bucket);
    await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'application/pdf' }));
    try {
      await getFirebaseAdminFirestore().doc(`lectureResources/${id}`).create({ ...metadata, published: false, size: bytes.length, key, createdBy: uid, createdAt: new Date().toISOString() });
    } catch (error) {
      await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      throw error;
    }
    return Response.json({ id }, { status: 201 });
  } catch (error) { return lectureError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireLectureAdmin(request);
    const data = JSON.parse((await readBoundedBody(request, 1024)).toString());
    if (typeof data.id !== 'string' || !lectureIdValid(data.id) || typeof data.published !== 'boolean') throw new Error('INVALID_REQUEST');
    const ref = getFirebaseAdminFirestore().doc(`lectureResources/${data.id}`);
    await getFirebaseAdminFirestore().runTransaction(async transaction => {
      const doc = await transaction.get(ref); if (!doc.exists) throw new Error('NOT_FOUND');
      transaction.update(ref, { published: data.published, updatedAt: new Date().toISOString() });
    });
    return Response.json({ ok: true });
  } catch (error) { return lectureError(error); }
}
