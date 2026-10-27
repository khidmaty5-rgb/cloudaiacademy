import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { getS3Client } from '@/lib/s3';
import { lectureIdValid } from '@/lib/lecture-resources';
import { lectureBucket, lectureError } from '@/server/lecture-resources';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!lectureIdValid(id)) throw new Error('NOT_FOUND');
    const doc = await getFirebaseAdminFirestore().doc(`lectureResources/${id}`).get();
    if (!doc.exists || doc.data()?.published !== true) throw new Error('NOT_FOUND');
    // Never accept a caller-supplied bucket/key, or serve certificates/lesson keys.
    const object = await getS3Client().send(new GetObjectCommand({ Bucket: lectureBucket(), Key: `lecture-resources/${id}.pdf` }));
    if (!object.Body) throw new Error('NOT_FOUND');
    return new Response(object.Body.transformToWebStream() as ReadableStream, { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="lecture-${id}.pdf"`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'private, no-store',
    } });
  } catch (error) { return lectureError(error); }
}
