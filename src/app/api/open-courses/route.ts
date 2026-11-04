import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
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
    const items = result.docs.filter(doc => doc.data().lifecycle !== 'purged' && (manage || !doc.data().lifecycle)).map(doc => openCourseView(doc.id, doc.data() as typeof builtinCourse));
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
    if (data.action !== undefined) {
      if (!validOpenCourseId(data.id || '') || !Number.isInteger(data.revision) || data.revision < 0 || !['trash', 'restore'].includes(data.action)) throw new Error('INVALID_REQUEST');
      const db = getFirebaseAdminFirestore(); const ref = db.doc(`openCourses/${data.id}`);
      await db.runTransaction(async tx => {
        const doc = await tx.get(ref); const current = doc.exists ? doc.data()! : data.id === 'number-systems' ? builtinCourse : null;
        if (!current) throw new Error('NOT_FOUND');
        if (current.revision !== data.revision || (data.action === 'trash' ? Boolean('lifecycle' in current && current.lifecycle) : !('lifecycle' in current) || current.lifecycle !== 'trashed')) throw new Error('CONFLICT');
        const next = { ...current, published: false, revision: current.revision + 1, updatedBy: uid, updatedAt: new Date().toISOString() } as Record<string, unknown>;
        if (data.action === 'trash') { next.lifecycle = 'trashed'; next.trashedAt = new Date().toISOString(); } else { delete next.lifecycle; delete next.trashedAt; }
        tx.set(ref, next);
      });
      return Response.json({ ok: true }, { headers });
    }
    if (!validOpenCourseId(data.id || '') || !Number.isInteger(data.revision) || data.revision < 0 ||
      (data.metadata === undefined && data.published === undefined) || (data.published !== undefined && typeof data.published !== 'boolean')) throw new Error('INVALID_REQUEST');
    const metadata = data.metadata === undefined ? undefined : courseMetadata(data.metadata);
    if (data.published === true) await openCourseContent(data.id);
    const db = getFirebaseAdminFirestore(); const ref = db.doc(`openCourses/${data.id}`);
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref); const current = doc.exists ? doc.data()! : data.id === 'number-systems' ? builtinCourse : null;
      if (!current) throw new Error('NOT_FOUND');
      if ('lifecycle' in current && current.lifecycle) throw new Error('CONFLICT');
      if (current.revision !== data.revision) throw new Error('CONFLICT');
      tx.set(ref, { ...current, ...metadata, published: data.published ?? current.published, revision: current.revision + 1, updatedBy: uid, updatedAt: new Date().toISOString() });
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) { return openCourseError(error); }
}

// Replace private content only. Upload immutable bytes first, then atomically
// advance the pointer and revision. Retain previous versions for recovery.
export async function PUT(request: Request) {
  try {
    const uid = await requireLectureAdmin(request);
    const data = await body(request, OPEN_COURSE_REQUEST_LIMIT);
    if (!validOpenCourseId(data.id || '') || data.id === 'number-systems' || !Number.isInteger(data.revision) || data.revision < 1) throw new Error('INVALID_REQUEST');
    const pkg = interactivePackage(data.package);
    const metadata = courseMetadata(data.metadata);
    const db = getFirebaseAdminFirestore(); const ref = db.doc(`openCourses/${data.id}`);
    const before = await ref.get();
    if (!before.exists) throw new Error('NOT_FOUND');
    if (before.data()!.lifecycle || before.data()!.published || before.data()!.revision !== data.revision) throw new Error('CONFLICT');
    const bucket = lectureBucket(); await requirePrivateLectureBucket(bucket);
    const key = `open-courses/${data.id}/${randomUUID()}.json`;
    await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(pkg), ContentType: 'application/json' }));
    // Retain bytes on ambiguous commit failures; remove only a definitely
    // rejected upload, including one that raced with trash/permanent deletion.
    await db.runTransaction(async tx => {
      const doc = await tx.get(ref); const current = doc.data();
      if (!doc.exists || !current) throw new Error('NOT_FOUND');
      if (current.lifecycle || current.published || current.revision !== data.revision) throw new Error('CONFLICT');
      tx.set(ref, { ...current, ...metadata, contentKey: key, published: false, revision: current.revision + 1, updatedBy: uid, updatedAt: new Date().toISOString() });
    }).catch(async error => {
      if (error instanceof Error && ['CONFLICT', 'NOT_FOUND'].includes(error.message)) await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
      throw error;
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) { return openCourseError(error); }
}

// Keep a small tombstone: deleting the built-in override would resurrect its fallback.
// Student inbox records and attachments are intentionally never touched here.
export async function DELETE(request: Request) {
  try {
    const uid = await requireLectureAdmin(request); const data = await body(request, 2000);
    if (!validOpenCourseId(data.id || '') || !Number.isInteger(data.revision) || data.confirmation !== `DELETE ${data.id}`) throw new Error('INVALID_REQUEST');
    const db = getFirebaseAdminFirestore(); const ref = db.doc(`openCourses/${data.id}`);
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data(); if (!current) throw new Error('NOT_FOUND');
      if (current.revision !== data.revision || !['trashed', 'purging'].includes(current.lifecycle)) throw new Error('CONFLICT');
      tx.set(ref, { ...current, published: false, lifecycle: 'purging', updatedBy: uid });
    });
    if (data.id !== 'number-systems') {
      const bucket = lectureBucket(); await requirePrivateLectureBucket(bucket); const client = getS3Client();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `open-courses/${data.id}.json` }));
      // Bounded, retryable cleanup. List the first remaining page after each deletion.
      for (let page = 0; page < 5; page++) {
        const prefix = `open-courses/${data.id}/`;
        const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }));
        const keys = (result.Contents || []).map(object => object.Key).filter((key): key is string => typeof key === 'string');
        if (keys.some(key => !key.startsWith(prefix))) throw new Error('STORAGE_UNAVAILABLE');
        if (keys.length) {
          const removed = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })) } }));
          if (removed.Errors?.length) throw new Error('STORAGE_UNAVAILABLE');
        }
        if (!result.IsTruncated) break;
        if (page === 4) return Response.json({ pending: true }, { status: 202, headers });
      }
    }
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.lifecycle !== 'purging' || current.revision !== data.revision) throw new Error('CONFLICT');
      tx.set(ref, { lifecycle: 'purged', published: false, revision: current.revision + 1, deletedBy: uid, deletedAt: new Date().toISOString() });
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) { return openCourseError(error); }
}
