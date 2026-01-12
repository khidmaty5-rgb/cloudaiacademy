import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppJournal';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;

  if (usingEmulators) {
    return initializeApp({ projectId }, name);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .replace(/^'|'$/g, '')
    : undefined;
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
  }
  return initializeApp({ credential: applicationDefault(), projectId }, name);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    let decoded: any;
    try {
      decoded = await getAuth(app).verifyIdToken(idToken);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        try {
          const parts = idToken.split('.');
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          decoded = payload;
        } catch (e2) {
          throw e;
        }
      } else {
        throw e;
      }
    }

    const uid = decoded.uid || decoded.user_id || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const createdByEmail = (decoded.email as string | undefined) || null;
    const createdByName = (decoded.name as string | undefined) || (decoded.displayName as string | undefined) || null;

    const body = await req.json();
    const {
      articleId,
      title,
      abstract,
      authors,
      affiliations = [],
      keywords = [],
      license = 'CC BY 4.0',
      language,
      codeUrl,
      pdfPath,
    } = body || {};

    if (!articleId || typeof articleId !== 'string') {
      return NextResponse.json({ error: 'Invalid articleId' }, { status: 400 });
    }
    if (!title || !abstract || !authors || !pdfPath) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['en', 'ar'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language; must be en or ar' }, { status: 400 });
    }
    if (
      typeof pdfPath !== 'string' ||
      !pdfPath.startsWith(`journal/articles/${uid}/${articleId}/`)
    ) {
      return NextResponse.json({ error: 'Invalid pdfPath' }, { status: 400 });
    }
    if (!pdfPath.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid pdfPath; must end with .pdf' }, { status: 400 });
    }

    const db = getFirestore(app);

    const uiSnap = await db.doc('settings/ui').get();
    const journalEnabled = !uiSnap.exists || (uiSnap.data() as any)?.showJournalNav !== false;
    if (!journalEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const docRef = db.doc(`journalArticles/${articleId}`);
    const now = FieldValue.serverTimestamp();

    const bucket = (process.env.S3_BUCKET_JOURNAL || '').trim();
    if (!bucket) return NextResponse.json({ error: 'S3 bucket not configured' }, { status: 500 });
    try {
      const s3 = getS3Client();
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: pdfPath }));
      const maxBytes = 20 * 1024 * 1024;
      if (typeof head.ContentLength === 'number' && head.ContentLength > maxBytes) {
        return NextResponse.json({ error: 'PDF is too large. Max size is 20 MB.' }, { status: 400 });
      }
      if (head.ContentType && head.ContentType !== 'application/pdf') {
        return NextResponse.json({ error: 'Invalid PDF content type.' }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'PDF not found in S3' }, { status: 400 });
    }
    const pdfUrl = `/api/journal/articles/${articleId}/download`;

    const existing = await docRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: 'Article already exists' }, { status: 409 });
    }

    await docRef.create(
      {
        title,
        abstract,
        authors,
        affiliations: Array.isArray(affiliations) ? affiliations : [],
        keywords: Array.isArray(keywords) ? keywords : [],
        license,
        language,
        codeUrl: codeUrl || null,
        pdfPath,
        pdfUrl,
        manuscriptVersion: 1,
        manuscripts: [
          {
            version: 1,
            pdfPath,
            uploadedAt: now,
            uploadedBy: uid,
            note: '',
          },
        ],
        status: 'SUBMITTED',
        createdBy: uid,
        createdByEmail,
        createdByName,
        reviewRound: 0,
        reviewRoundStartedAt: null,
        reviewManuscriptVersion: null,
        issueId: null,
        createdAt: now,
        updatedAt: now,
        acceptedAt: null,
        publishedAt: null,
      },
    );

    return NextResponse.json({ ok: true, id: articleId }, { status: 200 });
  } catch (e: any) {
    console.error('journal/submit error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
