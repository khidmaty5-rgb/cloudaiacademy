import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '@/lib/s3';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppJournalDownload';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

function decodeTokenPayload(idToken: string) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  return JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );
}

async function verifyIdTokenOrDecode(app: App, idToken: string) {
  try {
    return await getAuth(app).verifyIdToken(idToken);
  } catch (e) {
    if (process.env.NODE_ENV === 'production') throw e;
    return decodeTokenPayload(idToken);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const app = getAdminApp();

    const mode = req.nextUrl.searchParams.get('mode');
    const dispositionRaw = req.nextUrl.searchParams.get('disposition');
    const disposition = dispositionRaw === 'attachment' ? 'attachment' : 'inline';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    let caller: any = null;
    if (idToken) {
      try {
        caller = await verifyIdTokenOrDecode(app, idToken);
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const db = getFirestore(app);
    const snap = await db.doc(`journalArticles/${id}`).get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const article = snap.data() as any;

    const isPublished = article.status === 'PUBLISHED';
    if (!isPublished) {
      if (!caller) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const uid = caller.uid || caller.user_id || caller.sub;
      const role = caller.role as string | undefined;
      const isStaff = role === 'admin' || role === 'editor';
      const isOwner = !!(uid && article.createdBy && uid === article.createdBy);
      if (!isStaff && !isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const key = article.pdfPath as string | undefined;
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
    }

    const bucket = (process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `${disposition}; filename="${id}.pdf"`,
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
