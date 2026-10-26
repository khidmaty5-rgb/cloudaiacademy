import 'server-only';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFObject } from 'pdf-lib';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { MAX_LECTURE_PDF_BYTES } from '@/lib/lecture-resources';
import { GetBucketAclCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';

// Fail closed on production configuration differences or missing inspection rights.
// No ACL/policy is changed by this check.
export async function requirePrivateLectureBucket(bucket: string) {
  try {
    const acl = await getS3Client().send(new GetBucketAclCommand({ Bucket: bucket }));
    if (acl.Grants?.some(grant => /AllUsers|AuthenticatedUsers/.test(grant.Grantee?.URI || ''))) throw new Error('PUBLIC_BUCKET');
    try {
      const result = await getS3Client().send(new GetBucketPolicyCommand({ Bucket: bucket }));
      const policy = JSON.parse(result.Policy || '{}');
      const statements = Array.isArray(policy.Statement) ? policy.Statement : [policy.Statement].filter(Boolean);
      // Conservatively reject every wildcard Allow, even if conditioned/prefix-limited.
      if (statements.some((statement: { Effect?: string; Principal?: unknown }) => statement.Effect === 'Allow' && JSON.stringify(statement.Principal).includes('*'))) throw new Error('PUBLIC_BUCKET');
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'NoSuchBucketPolicy') throw error;
    }
  } catch { throw new Error('STORAGE_PRIVACY_UNVERIFIED'); }
}

export async function requireLectureAdmin(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');
  let uid: string;
  try { uid = (await getFirebaseAdminAuth().verifyIdToken(token, true)).uid; }
  catch { throw new Error('UNAUTHORIZED'); }
  const profile = await getFirebaseAdminFirestore().doc(`users/${uid}`).get();
  if (profile.data()?.role !== 'admin') throw new Error('FORBIDDEN');
  return uid;
}

export function lectureBucket() {
  const bucket = (process.env.S3_BUCKET_LESSONS || process.env.S3_BUCKET_JOURNAL || '').trim();
  if (!bucket) throw new Error('STORAGE_UNAVAILABLE');
  return bucket;
}

export async function readBoundedBody(request: Request, maximum: number) {
  if (Number(request.headers.get('content-length')) > maximum) throw new Error('FILE_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_PDF');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('FILE_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function validateLecturePdf(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_LECTURE_PDF_BYTES) throw new Error('FILE_TOO_LARGE');
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-') throw new Error('INVALID_PDF');
  try {
    const pdf = await PDFDocument.load(bytes);
    if (!pdf.getPageCount()) throw new Error('INVALID_PDF');
    // Download-only PDFs must not contain executable actions or embedded payloads.
    const blocked = new Set(['JavaScript', 'JS', 'Launch', 'EmbeddedFiles', 'EmbeddedFile', 'RichMedia', 'XFA', 'OpenAction', 'AA', 'SubmitForm', 'ImportData']);
    const seen = new Set<PDFObject>();
    function inspect(object: PDFObject, depth = 0) {
      if (seen.has(object)) return;
      if (depth > 100) throw new Error('INVALID_PDF');
      seen.add(object);
      if (object instanceof PDFName && blocked.has(object.decodeText())) throw new Error('UNSAFE_PDF');
      if (object instanceof PDFDict) for (const [key, value] of object.entries()) {
        if (blocked.has(key.decodeText())) throw new Error('UNSAFE_PDF');
        inspect(value, depth + 1);
      }
      if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value, depth + 1);
    }
    for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
  } catch { throw new Error('INVALID_PDF'); }
}

export function lectureError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const status = code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'FILE_TOO_LARGE' ? 413 : ['INVALID_METADATA', 'INVALID_PDF', 'INVALID_REQUEST'].includes(code) ? 400 : 503;
  return Response.json({ error: code === 'STORAGE_PRIVACY_UNVERIFIED' ? code : status === 503 ? 'RESOURCES_UNAVAILABLE' : code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
