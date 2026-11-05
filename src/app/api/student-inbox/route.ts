import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getS3Client } from '@/lib/s3';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { lectureBucket, requirePrivateLectureBucket, requireLectureAdmin, readBoundedBody, validateLecturePdf } from '@/server/lecture-resources';
import { openCourseRecord } from '@/server/open-courses';
import { INBOX_BODY_LIMIT, INBOX_FILE_LIMIT, inboxText, validReceipt, inboxStatuses } from '@/lib/student-inbox';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : code === 'LIMIT_REACHED' ? 429 : code === 'FILE_TOO_LARGE' ? 413 : ['INVALID_REQUEST', 'INVALID_PDF', 'INVALID_IMAGE'].includes(code) ? 400 : 503;
  return json({ error: status === 503 ? 'INBOX_UNAVAILABLE' : code }, status);
}
async function body(request: Request, maximum = INBOX_BODY_LIMIT) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_REQUEST');
  const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin) throw new Error('FORBIDDEN');
  try { return JSON.parse((await readBoundedBody(request, maximum)).toString()); }
  catch (error) { if (error instanceof Error && error.message === 'FILE_TOO_LARGE') throw error; throw new Error('INVALID_REQUEST'); }
}
function publicItem(data: FirebaseFirestore.DocumentData, id: string) {
  return { id, courseId: data.courseId, kind: data.kind, name: data.name, title: data.title, message: data.message, status: data.status, reply: data.reply, createdAt: data.createdAt, revision: data.revision, hasFile: Boolean(data.fileKey) };
}
// Durable hard budgets, not per-instance memory. No new billing service required.
// A hostile client can exhaust availability: these limits are not a substitute for WAF protection.
async function lookupBudget() {
  const db = getFirebaseAdminFirestore(); const ref = db.doc('studentInboxLimits/lookups'); const day = new Date().toISOString().slice(0, 10);
  await db.runTransaction(async tx => { const old = (await tx.get(ref)).data(); const count = old?.day === day ? old.count : 0; if (count >= 2000) throw new Error('LIMIT_REACHED'); tx.set(ref, { day, count: count + 1 }); });
}
async function attemptBudget(request: Request) {
  const db = getFirebaseAdminFirestore(); const ref = db.doc('studentInboxLimits/attempts'); const day = new Date().toISOString().slice(0, 10);
  await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data() || {}; const current = old.day === day;
    const salt = current ? old.salt : randomBytes(32).toString('hex');
    const ip = process.env.VERCEL ? request.headers.get('x-real-ip') || 'unknown' : 'local';
    const key = createHmac('sha256', salt).update(ip).digest('hex'); const ips = current ? old.ips || {} : {}; const count = current ? old.count || 0 : 0;
    if (count >= 200 || (ips[key] || 0) >= 20) throw new Error('LIMIT_REACHED');
    tx.set(ref, { day, salt, count: count + 1, ips: { ...ips, [key]: (ips[key] || 0) + 1 } });
  });
}
export async function POST(request: Request) {
  try {
    const input = await body(request);
    if (!input || !validReceipt(input.token)) throw new Error('INVALID_REQUEST');
    const db = getFirebaseAdminFirestore(); const id = hash(input.token); const ref = db.doc(`studentInbox/${id}`);
    if (input.action === 'status') {
      await lookupBudget(); const record = (await ref.get()).data(); if (!record) throw new Error('NOT_FOUND');
      return json(publicItem(record, id));
    }
    if (input.action !== 'submit' || input.website || !['assignment', 'question'].includes(input.kind)) throw new Error('INVALID_REQUEST');
    await attemptBudget(request);
    const courseId = inboxText(input.courseId, 80); const title = inboxText(input.title, 160); const name = inboxText(input.name, 100, false); const message = inboxText(input.message, 4000, input.kind === 'question');
    if (!(await openCourseRecord(courseId)).published) throw new Error('NOT_FOUND');
    const fingerprint = hash(JSON.stringify({ courseId, title, name, message, kind: input.kind, file: input.file || null }));
    const existing = (await ref.get()).data();
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('CONFLICT');
      if (existing.status !== 'processing') return json(publicItem(existing, id));
      // Retry the identical payload after a partial write; never reserve quota twice.
    }
    let bytes: Buffer | undefined; let mime = ''; let extension = '';
    if (input.kind === 'assignment') {
      if (!input.file || typeof input.file.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.file.data)) throw new Error('INVALID_REQUEST');
      bytes = Buffer.from(input.file.data, 'base64'); if (!bytes.length || bytes.length > INBOX_FILE_LIMIT) throw new Error('FILE_TOO_LARGE');
      if (input.file.type === 'application/pdf') { await validateLecturePdf(bytes); mime = 'application/pdf'; extension = 'pdf'; }
      else if (['image/png', 'image/jpeg'].includes(input.file.type)) {
        try { const image = sharp(bytes, { limitInputPixels: 16_000_000, animated: false }); const metadata = await image.metadata(); if (!['png', 'jpeg'].includes(metadata.format || '') || (metadata.pages || 1) !== 1) throw new Error(); bytes = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); }
        catch { throw new Error('INVALID_IMAGE'); }
        mime = 'image/jpeg'; extension = 'jpg'; if (bytes.length > INBOX_FILE_LIMIT) throw new Error('FILE_TOO_LARGE');
      } else throw new Error('INVALID_REQUEST');
    } else if (input.file) throw new Error('INVALID_REQUEST');
    const bucket = bytes ? lectureBucket() : ''; if (bytes) await requirePrivateLectureBucket(bucket);
    const now = new Date().toISOString(); const day = now.slice(0, 10); const limitRef = db.doc('studentInboxLimits/submissions');
    const record = { courseId, title, name, message, kind: input.kind, fingerprint, status: 'processing', reply: '', revision: 0, createdAt: now, fileKey: bytes ? `student-inbox/${id}.${extension}` : '', mime };
    const reserved = await db.runTransaction(async tx => {
      const [entry, budget] = await Promise.all([tx.get(ref), tx.get(limitRef)]);
      if (entry.exists) { if (entry.data()?.fingerprint !== fingerprint) throw new Error('CONFLICT'); return false; }
      const old = budget.data() || {}; const sameDay = old.day === day; const salt = sameDay ? old.salt : randomBytes(32).toString('hex');
      // Vercel sets x-real-ip; unknown/non-Vercel callers share one restrictive bucket.
      const ip = process.env.VERCEL ? request.headers.get('x-real-ip') || 'unknown' : 'local'; const ipKey = createHmac('sha256', salt).update(ip).digest('hex');
      const ips = sameDay ? old.ips || {} : {}; const count = sameDay ? old.count || 0 : 0; const total = old.total || 0; const size = (old.bytes || 0) + (bytes?.length || 0);
      if (count >= 50 || (ips[ipKey] || 0) >= 5 || total >= 1000 || size > 100_000_000) throw new Error('LIMIT_REACHED');
      tx.set(limitRef, { day, salt, count: count + 1, total: total + 1, bytes: size, ips: { ...ips, [ipKey]: (ips[ipKey] || 0) + 1 } }); tx.create(ref, record); return true;
    });
    if (!reserved) { const saved = (await ref.get()).data()!; if (saved.status !== 'processing') return json(publicItem(saved, id)); }
    if (bytes) await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: record.fileKey, Body: bytes, ContentType: mime, ContentDisposition: `attachment; filename="assignment.${extension}"` }));
    // Never acknowledge successful upload until both durable writes have completed.
    const saved = await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.fingerprint !== fingerprint) throw new Error('CONFLICT');
      // A concurrent retry or reviewer may already have advanced the state.
      if (current.status !== 'processing') return current;
      tx.update(ref, { status: 'under_review' });
      return { ...current, status: 'under_review' };
    });
    return json(publicItem(saved, id), reserved ? 201 : 200);
  } catch (error) { return failure(error); }
}
export async function GET(request: Request) {
  try {
    await requireLectureAdmin(request); const url = new URL(request.url); const id = url.searchParams.get('file'); const db = getFirebaseAdminFirestore();
    if (id) {
      if (!validReceipt(id)) throw new Error('NOT_FOUND'); const item = (await db.doc(`studentInbox/${id}`).get()).data();
      if (!item || item.status === 'processing' || !new RegExp(`^student-inbox/${id}\\.(pdf|jpg)$`).test(item.fileKey)) throw new Error('NOT_FOUND');
      const bucket = lectureBucket(); await requirePrivateLectureBucket(bucket); const object = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: item.fileKey }));
      if (!object.Body || (object.ContentLength || 0) > INBOX_FILE_LIMIT) throw new Error('NOT_FOUND');
      return new Response(object.Body.transformToWebStream(), { headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="assignment-${id.slice(0, 12)}.${item.mime === 'application/pdf' ? 'pdf' : 'jpg'}"`, 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    }
    const after = url.searchParams.get('after'); if (after && !validReceipt(after)) throw new Error('INVALID_REQUEST');
    let query = db.collection('studentInbox').orderBy('__name__').limit(30); if (after) query = query.startAfter(after);
    const snapshot = await query.get(); return json({ items: snapshot.docs.map(doc => publicItem(doc.data(), doc.id)), next: snapshot.size === 30 ? snapshot.docs[29].id : null });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const uid = await requireLectureAdmin(request); const input = await body(request, 12000);
    if (!validReceipt(input.id) || !inboxStatuses.includes(input.status) || !Number.isSafeInteger(input.revision)) throw new Error('INVALID_REQUEST');
    const reply = inboxText(input.reply, 4000, false); const db = getFirebaseAdminFirestore(); const ref = db.doc(`studentInbox/${input.id}`);
    await db.runTransaction(async tx => { const item = (await tx.get(ref)).data(); if (!item) throw new Error('NOT_FOUND'); if (item.status === 'processing' || item.revision !== input.revision) throw new Error('CONFLICT'); tx.update(ref, { reply, status: input.status, revision: item.revision + 1, reviewedBy: uid, updatedAt: new Date().toISOString() }); });
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
