import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  getEffectiveJournalRole,
  isJournalEditorialStaff,
} from '@/server/journal-access';
import { hasJournalReviewerAssignment } from '@/server/journal-reviewer-assignments';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppJournalReviews';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const usingEmulators = !!(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
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
    return initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }), projectId },
      name,
    );
  }

  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const tryPaths: string[] = [];
  if (explicitPath) tryPaths.push(explicitPath);
  const levels = ['', '..', '../..', '../../..', '../../../..'];
  for (const lvl of levels) {
    tryPaths.push(path.join(process.cwd(), lvl, 'config', 'serviceAccount.local.json'));
  }
  for (const p of tryPaths) {
    try {
      if (p && existsSync(p)) {
        const raw = readFileSync(p, 'utf8');
        const sa = JSON.parse(raw) as {
          project_id: string;
          client_email: string;
          private_key: string;
        };
        const pId = sa.project_id || projectId;
        if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = pId;
        if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = pId;
        const pk = sa.private_key?.includes('\\n')
          ? sa.private_key.replace(/\\n/g, '\n')
          : sa.private_key;
        return initializeApp(
          {
            credential: cert({ projectId: pId, clientEmail: sa.client_email, privateKey: pk }),
            projectId: pId,
          },
          name,
        );
      }
    } catch {}
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

const allowedRecommendations = new Set(['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT']);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    const decoded: any = await verifyIdTokenOrDecode(app, token);
    const uid = decoded.uid || decoded.user_id || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getFirestore(app);
    const articleRef = db.doc(`journalArticles/${id}`);
    const articleSnap = await articleRef.get();
    if (!articleSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const article = articleSnap.data() as any;

    const isOwner = !!(article?.createdBy && article.createdBy === uid);
    let isReviewer = false;
    let isStaff = false;
    if (!isOwner) {
      const effectiveRole = await getEffectiveJournalRole(db, uid, (decoded as any)?.role);
      isReviewer =
        effectiveRole === 'reviewer' &&
        (await hasJournalReviewerAssignment(db, id, uid));
      isStaff = isJournalEditorialStaff(effectiveRole);
    }

    if (!isStaff && !isReviewer && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roundRaw = Number(article?.reviewRound);
    const round = Number.isFinite(roundRaw) && roundRaw >= 1 ? roundRaw : 1;
    const mvRaw = Number(article?.reviewManuscriptVersion ?? article?.manuscriptVersion);
    const manuscriptVersion = Number.isFinite(mvRaw) && mvRaw >= 1 ? mvRaw : 1;
    const reviewDocId = `${round}_${uid}`;

    if (isStaff) {
      const reviewsSnap = await articleRef.collection('reviews').get();
      const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return NextResponse.json({ ok: true, reviews }, { status: 200 });
    }

    const own = await articleRef.collection('reviews').doc(reviewDocId).get();
    if (own.exists) {
      return NextResponse.json(
        { ok: true, review: { id: own.id, ...(own.data() as any), round, manuscriptVersion } },
        { status: 200 },
      );
    }

    // Backward-compatible: legacy docs were stored under reviewer uid.
    const legacy = await articleRef.collection('reviews').doc(uid).get();
    return NextResponse.json(
      { ok: true, review: legacy.exists ? { id: legacy.id, ...(legacy.data() as any) } : null },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('journal reviews GET error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    const decoded: any = await verifyIdTokenOrDecode(app, token);
    const uid = decoded.uid || decoded.user_id || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recommendation = body?.recommendation as string | undefined;
    const commentsToAuthor = body?.commentsToAuthor as string | undefined;
    const commentsToEditor = body?.commentsToEditor as string | undefined;

    if (!recommendation || !allowedRecommendations.has(recommendation)) {
      return NextResponse.json({ error: 'Invalid recommendation' }, { status: 400 });
    }
    if (!commentsToAuthor || typeof commentsToAuthor !== 'string' || commentsToAuthor.trim().length < 10) {
      return NextResponse.json({ error: 'Comments to author must be at least 10 characters' }, { status: 400 });
    }
    if (commentsToEditor && typeof commentsToEditor !== 'string') {
      return NextResponse.json({ error: 'Invalid commentsToEditor' }, { status: 400 });
    }

    const db = getFirestore(app);
    const effectiveRole = await getEffectiveJournalRole(db, uid, (decoded as any)?.role);
    const articleRef = db.doc(`journalArticles/${id}`);
    const articleSnap = await articleRef.get();
    if (!articleSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const article = articleSnap.data() as any;

    const isReviewer =
      effectiveRole === 'reviewer' &&
      (await hasJournalReviewerAssignment(db, id, uid));
    const isStaff = isJournalEditorialStaff(effectiveRole);

    if (!isReviewer && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isStaff && article?.status !== 'UNDER_REVIEW') {
      return NextResponse.json({ error: 'Article is not accepting reviews right now' }, { status: 400 });
    }

    const roundRaw = Number(article?.reviewRound);
    const round = Number.isFinite(roundRaw) && roundRaw >= 1 ? roundRaw : 1;
    const mvRaw = Number(article?.reviewManuscriptVersion ?? article?.manuscriptVersion);
    const manuscriptVersion = Number.isFinite(mvRaw) && mvRaw >= 1 ? mvRaw : 1;
    const reviewDocId = `${round}_${uid}`;

    const now = FieldValue.serverTimestamp();
    const reviewRef = articleRef.collection('reviews').doc(reviewDocId);
    const existing = await reviewRef.get();
    const createdAt = existing.exists ? (existing.data() as any)?.createdAt || now : now;

    await reviewRef.set(
      {
        reviewerId: uid,
        reviewerEmail: (decoded.email as string | undefined) || null,
        recommendation,
        commentsToAuthor: commentsToAuthor.trim(),
        commentsToEditor: commentsToEditor ? commentsToEditor.trim() : '',
        round,
        manuscriptVersion,
        createdAt,
        updatedAt: now,
        submittedAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('journal reviews POST error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
