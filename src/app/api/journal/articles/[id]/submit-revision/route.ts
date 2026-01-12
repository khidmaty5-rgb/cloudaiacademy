import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppJournalSubmitRevision';
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

function normalizeManuscripts(existing: any, fallback: { pdfPath: string; uploadedBy: string; uploadedAt: any } | null) {
  const list = Array.isArray(existing) ? existing : [];
  const out: any[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const version = Number((item as any).version);
    const pdfPath = (item as any).pdfPath;
    if (!Number.isFinite(version) || version <= 0) continue;
    if (typeof pdfPath !== 'string' || !pdfPath) continue;
    out.push(item);
  }
  if (out.length === 0 && fallback) {
    out.push({ version: 1, pdfPath: fallback.pdfPath, uploadedAt: fallback.uploadedAt, uploadedBy: fallback.uploadedBy, note: '' });
  }
  out.sort((a, b) => Number(a.version) - Number(b.version));
  return out;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

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
    const uid = decoded.uid || decoded.user_id || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getFirestore(app);
    const uiSnap = await db.doc('settings/ui').get();
    const journalEnabled = !uiSnap.exists || (uiSnap.data() as any)?.showJournalNav !== false;
    if (!journalEnabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const pdfPath = body?.pdfPath as string | undefined;
    const noteRaw = body?.note as string | undefined;
    const note = typeof noteRaw === 'string' ? noteRaw.trim().slice(0, 2000) : '';

    if (typeof pdfPath !== 'string' || !pdfPath) {
      return NextResponse.json({ error: 'Missing pdfPath' }, { status: 400 });
    }
    if (!pdfPath.startsWith(`journal/articles/${uid}/${id}/`)) {
      return NextResponse.json({ error: 'Invalid pdfPath' }, { status: 400 });
    }
    if (!pdfPath.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid pdfPath; must end with .pdf' }, { status: 400 });
    }

    const articleRef = db.doc(`journalArticles/${id}`);
    const snap = await articleRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const article = snap.data() as any;
    if (!article?.createdBy || article.createdBy !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = article?.status as string | undefined;
    const canSubmitRevision =
      status === 'REVISION_REQUIRED_MINOR' || status === 'REVISION_REQUIRED_MAJOR';
    if (!canSubmitRevision) {
      return NextResponse.json({ error: 'Revision is not requested for this article' }, { status: 400 });
    }

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
    } catch {
      return NextResponse.json({ error: 'PDF not found in S3' }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const fallbackPdfPath = typeof article?.pdfPath === 'string' && article.pdfPath ? article.pdfPath : '';
    const fallback = fallbackPdfPath
      ? { pdfPath: fallbackPdfPath, uploadedAt: article?.createdAt || now, uploadedBy: uid }
      : null;
    const manuscripts = normalizeManuscripts(article?.manuscripts, fallback);
    const currentRaw = Number(article?.manuscriptVersion);
    const maxFromList = manuscripts.reduce((m, item) => Math.max(m, Number(item?.version) || 0), 0);
    const base = Math.max(Number.isFinite(currentRaw) ? currentRaw : 0, maxFromList, 0);
    const nextVersion = base + 1;

    const nextEntry = {
      version: nextVersion,
      pdfPath,
      uploadedAt: now,
      uploadedBy: uid,
      note,
    };

    await articleRef.set(
      {
        pdfPath,
        pdfUrl: `/api/journal/articles/${id}/download`,
        manuscriptVersion: nextVersion,
        manuscripts: [...manuscripts, nextEntry],
        status: 'REVISED_SUBMITTED',
        updatedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, manuscriptVersion: nextVersion }, { status: 200 });
  } catch (e: any) {
    console.error('journal submit-revision error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

