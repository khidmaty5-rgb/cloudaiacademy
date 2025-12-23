import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminAppWithCert(): App | null {
  const name = 'adminAppCertificatesDeletePdf';
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

function isSafeUid(id: string) {
  return /^[a-zA-Z0-9_-]{6,128}$/.test(id);
}

function isSafeCertificateId(id: string) {
  return /^[a-zA-Z0-9-]{6,64}$/.test(id);
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

export async function POST(req: NextRequest) {
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
    const isStaff = role === 'admin' || role === 'teacher';
    if (!isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { certificateId, studentUid, pdfPath } = await req.json().catch(() => ({}));

    if (typeof certificateId !== 'string' || !isSafeCertificateId(certificateId)) {
      return NextResponse.json({ error: 'Invalid certificateId' }, { status: 400 });
    }

    const key =
      typeof pdfPath === 'string' && isSafePdfPath(pdfPath)
        ? pdfPath
        : typeof studentUid === 'string' && isSafeUid(studentUid)
          ? `certificates/${studentUid}/${certificateId}.pdf`
          : '';

    if (!key) {
      return NextResponse.json({ error: 'Missing or invalid pdfPath/studentUid' }, { status: 400 });
    }

    const bucket = (process.env.S3_BUCKET_CERTIFICATES || process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

    return NextResponse.json({ ok: true, key }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
