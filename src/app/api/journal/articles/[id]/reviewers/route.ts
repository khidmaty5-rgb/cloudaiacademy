import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  getEffectiveJournalRole,
  isJournalEditorialStaff,
} from '@/server/journal-access';
import {
  journalReviewerAssignmentRef,
  listJournalReviewerAssignmentsForArticle,
} from '@/server/journal-reviewer-assignments';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppJournalReviewers';
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

type Action = 'add' | 'remove';

type EditorialContext = {
  app: App;
  db: Firestore;
  uid: string;
};

async function requireEditorialContext(
  req: NextRequest,
): Promise<{ context?: EditorialContext; response?: NextResponse }> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const app = getAdminApp();
  let decoded: any;
  try {
    decoded = await verifyIdTokenOrDecode(app, token);
  } catch {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const uid = decoded.uid || decoded.user_id || decoded.sub;
  if (!uid) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const db = getFirestore(app);
  const effectiveRole = await getEffectiveJournalRole(db, uid, (decoded as any)?.role);
  if (!isJournalEditorialStaff(effectiveRole)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { context: { app, db, uid } };
}

function reviewerResponse(
  assignments: Awaited<ReturnType<typeof listJournalReviewerAssignmentsForArticle>>,
) {
  return assignments
    .map((assignment) => ({
      uid: assignment.reviewerId,
      email: assignment.reviewerEmail,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const authorization = await requireEditorialContext(req);
    if (authorization.response) return authorization.response;

    const assignments = await listJournalReviewerAssignmentsForArticle(
      authorization.context!.db,
      id,
    );
    return NextResponse.json(
      { ok: true, reviewers: reviewerResponse(assignments) },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('journal reviewers GET error:', e);
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

    const authorization = await requireEditorialContext(req);
    if (authorization.response) return authorization.response;
    const { app, db, uid } = authorization.context!;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action | undefined;
    const emailRaw = body?.email as string | undefined;
    const uidRaw = body?.uid as string | undefined;

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    let targetUid: string | undefined = uidRaw && typeof uidRaw === 'string' ? uidRaw : undefined;
    let targetEmail: string | undefined =
      emailRaw && typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : undefined;

    if (!targetUid && !targetEmail) {
      return NextResponse.json({ error: 'Missing reviewer email or uid' }, { status: 400 });
    }

    if (!targetUid && targetEmail) {
      const user = await getAuth(app).getUserByEmail(targetEmail);
      targetUid = user.uid;
      targetEmail = (user.email || targetEmail).toLowerCase();
    } else if (targetUid && !targetEmail && action === 'add') {
      const user = await getAuth(app).getUser(targetUid);
      targetEmail = (user.email || '').toLowerCase();
    }

    if (!targetUid) {
      return NextResponse.json({ error: 'Unable to resolve reviewer uid' }, { status: 400 });
    }
    if (action === 'add' && !targetEmail) {
      return NextResponse.json(
        { error: 'Reviewer account must have an email address' },
        { status: 400 },
      );
    }

    // Enforce dedicated reviewer accounts (role=reviewer) when assigning.
    if (action === 'add') {
      const reviewerProfileSnap = await db.doc(`users/${targetUid}`).get();
      const reviewerRole = reviewerProfileSnap.exists
        ? ((reviewerProfileSnap.data() as any)?.role as string | undefined)
        : undefined;
      if (reviewerRole !== 'reviewer') {
        return NextResponse.json(
          { error: 'Reviewer must be an account with role "reviewer". Create it in Admin > Users first.' },
          { status: 400 },
        );
      }
    }

    const ref = db.doc(`journalArticles/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const assignmentRef = journalReviewerAssignmentRef(db, id, targetUid);
    const batch = db.batch();
    if (action === 'add') {
      batch.set(
        assignmentRef,
        {
          articleId: id,
          reviewerId: targetUid,
          reviewerEmail: targetEmail || '',
          assignedAt: FieldValue.serverTimestamp(),
          assignedBy: uid,
        },
        { merge: true },
      );
    } else {
      batch.delete(assignmentRef);
    }

    // Remove any legacy reviewer identity fields from the author-readable article.
    batch.set(
      ref,
      {
        reviewerIds: FieldValue.delete(),
        reviewerEmails: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();

    const assignments = await listJournalReviewerAssignmentsForArticle(db, id);
    return NextResponse.json(
      { ok: true, reviewers: reviewerResponse(assignments) },
      { status: 200 },
    );
  } catch (e: any) {
    console.error('journal reviewers error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
