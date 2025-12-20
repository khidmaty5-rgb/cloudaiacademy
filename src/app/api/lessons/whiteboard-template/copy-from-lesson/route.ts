import { NextRequest, NextResponse } from 'next/server';
import { CopyObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

const WHITEBOARD_TEMPLATE_KEY = 'lessons/shared/whiteboard.pdf';

function getAdminApp(): App {
  const name = 'adminAppLessonWhiteboardTemplateCopy';
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

function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    let decoded: any;
    try {
      decoded = await verifyIdTokenOrDecode(app, idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = decoded?.role as string | undefined;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const courseId = String(body?.courseId || '');
    const lessonId = String(body?.lessonId || '');
    if (!courseId || !lessonId) {
      return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });
    }
    if (!isSafeId(courseId) || !isSafeId(lessonId)) {
      return NextResponse.json({ error: 'Invalid courseId or lessonId' }, { status: 400 });
    }

    const db = getFirestore(app);
    const lessonSnap = await db.doc(`courses/${courseId}/lessons/${lessonId}`).get();
    if (!lessonSnap.exists) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    const lesson = lessonSnap.data() as any;

    const sourceKey = lesson?.pdfPath as string | undefined;
    if (!sourceKey || typeof sourceKey !== 'string') {
      return NextResponse.json({ error: 'Lesson PDF not found' }, { status: 404 });
    }
    const expectedPrefix = `courses/${courseId}/lessons/${lessonId}/`;
    if (!sourceKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid lesson PDF path' }, { status: 400 });
    }

    const bucket = (process.env.S3_BUCKET_LESSONS || process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: WHITEBOARD_TEMPLATE_KEY,
        CopySource: `/${bucket}/${sourceKey}`,
        ContentType: 'application/pdf',
        MetadataDirective: 'REPLACE',
      }),
    );

    return NextResponse.json({ ok: true, key: WHITEBOARD_TEMPLATE_KEY }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

