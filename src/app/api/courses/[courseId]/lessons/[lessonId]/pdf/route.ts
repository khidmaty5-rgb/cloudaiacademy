import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '@/lib/s3';
import { firebaseConfig } from '@/firebase/config';
import { isPriceFree } from '@/lib/course-price';
import { isLearnerRole } from '@/lib/roles';
import { getEffectiveUserRole } from '@/server/effective-user-role';

export const runtime = 'nodejs';

const WHITEBOARD_TEMPLATE_KEY = 'lessons/shared/whiteboard.pdf';

function getAdminApp(): App {
  const name = 'adminAppLessonPdfDownload';
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

function canTeachCourse(course: any, uid: string) {
  if (!course || !uid) return false;
  if (course.ownerId && course.ownerId === uid) return true;
  const arr: unknown = course.instructorIds;
  return Array.isArray(arr) && arr.includes(uid);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseId: string; lessonId: string }> },
) {
  try {
    const { courseId, lessonId } = await context.params;
    if (!courseId || !lessonId) {
      return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });
    }
    if (!isSafeId(courseId) || !isSafeId(lessonId)) {
      return NextResponse.json({ error: 'Invalid courseId or lessonId' }, { status: 400 });
    }

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

    const uid = decoded?.uid || decoded?.user_id || decoded?.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = getFirestore(app);
    const role = await getEffectiveUserRole(db, String(uid), decoded?.role);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const courseSnap = await db.doc(`courses/${courseId}`).get();
    if (!courseSnap.exists) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    const course = courseSnap.data() as any;
    const isFreeCourse = isPriceFree(course?.price);

    const isAdmin = role === 'admin';
    const isTeacherInstructor = role === 'teacher' && canTeachCourse(course, String(uid));

    let allowed = isAdmin || isTeacherInstructor;
    if (!allowed) {
      // Learner access: must be enrolled AND either the course is free, the course was purchased,
      // or the learner's account is not paywalled (e.g. subscription active / paywall off).
      if (!isLearnerRole(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const enrollmentSnap = await db.doc(`users/${uid}/enrollments/${courseId}`).get();
      if (!enrollmentSnap.exists) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const profileSnap = await db.doc(`users/${uid}`).get();
      const requirePaymentValue = profileSnap.exists ? (profileSnap.data() as any)?.requirePayment : null;

      const paymentSettingsSnap = await db.doc('settings/payment').get();
      const paywallEnabled =
        paymentSettingsSnap.exists && (paymentSettingsSnap.data() as any)?.paywall?.enabled === true;
      const defaultRequirePayment =
        paymentSettingsSnap.exists &&
        (paymentSettingsSnap.data() as any)?.paywall?.defaultRequirePayment === true;

      const accountActive =
        !paywallEnabled || (defaultRequirePayment ? requirePaymentValue === false : requirePaymentValue !== true);

      if (isFreeCourse || accountActive) {
        allowed = true;
      } else {
        const purchaseSnap = await db.doc(`users/${uid}/coursePurchases/${courseId}`).get();
        allowed = purchaseSnap.exists;
      }
    }

    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const lessonSnap = await db.doc(`courses/${courseId}/lessons/${lessonId}`).get();
    if (!lessonSnap.exists) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    const lesson = lessonSnap.data() as any;

    const key = lesson?.pdfPath as string | undefined;
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
    }
    if (key !== WHITEBOARD_TEMPLATE_KEY) {
      return NextResponse.json({ error: 'Invalid PDF path' }, { status: 400 });
    }

    const mode = req.nextUrl.searchParams.get('mode');
    const dispositionRaw = req.nextUrl.searchParams.get('disposition');
    if (dispositionRaw === 'attachment') {
      return NextResponse.json({ error: 'Downloads are disabled for lesson PDFs' }, { status: 400 });
    }
    const disposition = 'inline';

    const bucket = (process.env.S3_BUCKET_LESSONS || process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });

    const s3 = getS3Client();
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: 'application/pdf',
      ResponseContentDisposition: `${disposition}; filename="${lessonId}.pdf"`,
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
