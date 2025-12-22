import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '@/lib/s3';
import { fetchPublicFirestoreDoc } from '@/lib/firestore-public';

export const runtime = 'nodejs';

function isSafeCertificateId(id: string) {
  return /^[a-zA-Z0-9-]{6,64}$/.test(id);
}

function isSafePdfPath(path: string) {
  return (
    typeof path === 'string' &&
    path.startsWith('certificates/') &&
    path.toLowerCase().endsWith('.pdf') &&
    !path.includes('..')
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const { certificateId: rawId } = await context.params;
    if (!rawId) return NextResponse.json({ error: 'Missing certificateId' }, { status: 400 });
    const certificateId = (() => {
      try {
        return decodeURIComponent(rawId);
      } catch {
        return rawId;
      }
    })();
    if (!isSafeCertificateId(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificateId' }, { status: 400 });
    }

    const mode = req.nextUrl.searchParams.get('mode');
    const dispositionRaw = req.nextUrl.searchParams.get('disposition');
    const disposition = dispositionRaw === 'attachment' ? 'attachment' : 'inline';

    const pub = await fetchPublicFirestoreDoc(`certificates/${certificateId}`);
    if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const cert = pub.data as any;
    const key = cert?.pdfPath as string | undefined;
    if (!key || !isSafePdfPath(key)) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
    }

    const bucket = (process.env.S3_BUCKET_CERTIFICATES || process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `${disposition}; filename="${certificateId}.pdf"`,
    });
    const signed = await getSignedUrl(s3, cmd, { expiresIn: 60 * 10 });

    if (mode === 'json') {
      return NextResponse.json({ ok: true, url: signed }, { status: 200 });
    }
    return NextResponse.redirect(signed, 302);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
