import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
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
    const requesterRole = (decoded as any)?.role as string | undefined;
    if (requesterRole !== 'admin' && requesterRole !== 'editor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    } else if (targetUid && !targetEmail) {
      const user = await getAuth(app).getUser(targetUid);
      targetEmail = (user.email || '').toLowerCase();
    }

    if (!targetUid) {
      return NextResponse.json({ error: 'Unable to resolve reviewer uid' }, { status: 400 });
    }

    const db = getFirestore(app);

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
    const data = snap.data() as any;
    const currentIds: string[] = Array.isArray(data?.reviewerIds) ? data.reviewerIds : [];
    const currentEmails: string[] = Array.isArray(data?.reviewerEmails) ? data.reviewerEmails : [];

    const idToEmail = new Map<string, string>();
    for (let i = 0; i < currentIds.length; i += 1) {
      const rid = currentIds[i];
      if (typeof rid !== 'string' || !rid) continue;
      const em = currentEmails[i];
      if (typeof em === 'string' && em) idToEmail.set(rid, em);
      else if (!idToEmail.has(rid)) idToEmail.set(rid, '');
    }

    if (action === 'add') {
      idToEmail.set(targetUid, targetEmail || idToEmail.get(targetUid) || '');
    } else {
      idToEmail.delete(targetUid);
    }

    const nextIds = Array.from(idToEmail.keys());
    const nextEmails = nextIds.map((rid) => idToEmail.get(rid) || '');

    await ref.set(
      {
        reviewerIds: nextIds,
        reviewerEmails: nextEmails,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, reviewerIds: nextIds, reviewerEmails: nextEmails }, { status: 200 });
  } catch (e: any) {
    console.error('journal reviewers error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
