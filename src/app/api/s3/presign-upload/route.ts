import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '@/lib/s3';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminAppWithCert(): App | null {
  const name = 'adminAppS3Presign';
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

async function verifyIdTokenOrDecode(idToken: string) {
  const app = getAdminAppWithCert();
  if (app) {
    try {
      return await getAuth(app).verifyIdToken(idToken);
    } catch (e) {
      if (process.env.NODE_ENV === 'production') throw e;
      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) throw e;
        return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      } catch {
        throw e;
      }
    }
  } else {
    if (process.env.NODE_ENV !== 'production') {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    }
    throw new Error('Server auth is not configured');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyIdTokenOrDecode(idToken);
    const uid = decoded?.uid || decoded?.user_id || decoded?.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { key, contentType } = await req.json();
    const bucket = (process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    if (typeof key !== 'string' || !key.startsWith(`journal/articles/${uid}/`)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }
    if (typeof contentType !== 'string' || contentType !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid contentType' }, { status: 400 });
    }

    const s3 = getS3Client();
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });

    return NextResponse.json({ ok: true, url }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
