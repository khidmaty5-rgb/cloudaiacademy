import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { getS3Client } from '@/lib/s3';
import { fetchPublicFirestoreDoc } from '@/lib/firestore-public';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminAppWithCert(): App | null {
  const name = 'adminAppCertificatesDownload';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }
  return null;
}

function decodeTokenPayload(idToken: string) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  return JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );
}

async function verifyIdTokenOrDecode(idToken: string) {
  const app = getAdminAppWithCert();
  if (app) {
    try {
      return await getAuth(app).verifyIdToken(idToken);
    } catch (e) {
      if (process.env.NODE_ENV === 'production') throw e;
      return decodeTokenPayload(idToken);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return decodeTokenPayload(idToken);
  }

  throw new Error('Server auth is not configured');
}

function isSafeCertificateId(id: string) {
  return /^[a-zA-Z0-9-]{6,64}$/.test(id);
}

function isSafeUid(id: string) {
  return /^[a-zA-Z0-9_-]{6,128}$/.test(id);
}

function isSafePdfPath(path: string) {
  return (
    typeof path === 'string' &&
    path.startsWith('certificates/') &&
    path.toLowerCase().endsWith('.pdf') &&
    !path.includes('..') &&
    !path.includes('\\')
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try {
      decoded = await verifyIdTokenOrDecode(idToken);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Server auth is not configured')) {
        return NextResponse.json({ error: 'Server auth is not configured' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (decoded?.role as string | undefined) || 'student';
    const isAdmin = role === 'admin';
    const requesterUid =
      (decoded?.uid as string | undefined) ||
      (decoded?.user_id as string | undefined) ||
      (decoded?.sub as string | undefined) ||
      '';

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
    if (String(cert?.status || 'ACTIVE').toUpperCase() === 'REVOKED') {
      return NextResponse.json({ error: 'Certificate revoked' }, { status: 403 });
    }

    const ownerUid = typeof cert?.userId === 'string' ? cert.userId : '';
    const isOwner = !!(ownerUid && requesterUid && ownerUid === requesterUid);
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const key = cert?.pdfPath as string | undefined;
    if (!key || !isSafePdfPath(key)) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
    }
    const userId = cert?.userId as string | undefined;
    if (typeof userId === 'string' && isSafeUid(userId)) {
      const expectedKey = `certificates/${userId}/${certificateId}.pdf`;
      if (key !== expectedKey) {
        return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
      }
    }

    const bucket = (process.env.S3_BUCKET_CERTIFICATES || process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const obj = await s3.send(cmd);
    if (!obj.Body) return NextResponse.json({ error: 'PDF not available' }, { status: 404 });

    if (mode === 'json') {
      const origin = req.nextUrl.origin;
      const url = `${origin}/api/certificates/${encodeURIComponent(certificateId)}/download?disposition=${encodeURIComponent(disposition)}`;
      return NextResponse.json({ ok: true, url }, { status: 200 });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `${disposition}; filename="${certificateId}.pdf"`);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (typeof obj.ContentLength === 'number') {
      headers.set('Content-Length', String(obj.ContentLength));
    }

    const body: any = obj.Body as any;
    // `GetObjectCommand` returns a Node.js Readable stream in the Node runtime.
    const stream =
      body instanceof Readable
        ? (Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>)
        : (body as ReadableStream<Uint8Array>);

    return new NextResponse(stream as any, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
