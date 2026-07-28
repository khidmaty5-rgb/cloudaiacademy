import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  getEffectiveJournalRole,
  isJournalEditorialStaff,
} from '@/server/journal-access';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

function getAdminApp(): App {
  const name = 'adminAppReviewerAssignments';
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

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const app = getAdminApp();
    const decoded: any = await verifyIdTokenOrDecode(app, token);
    const uid = decoded.uid || decoded.user_id || decoded.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getFirestore(app);

    // The current profile is authoritative so stale token claims cannot preserve access.
    const effectiveRole = await getEffectiveJournalRole(db, uid, (decoded as any)?.role);
    const isStaff = isJournalEditorialStaff(effectiveRole);
    const isReviewer = effectiveRole === 'reviewer';
    if (!isStaff && !isReviewer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snap = await db
      .collection('journalArticles')
      .where('reviewerIds', 'array-contains', uid)
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || '',
        authors: data.authors || '',
        status: data.status || '',
        language: data.language || '',
        manuscriptVersion: data.manuscriptVersion || null,
        reviewRound: data.reviewRound || null,
        reviewManuscriptVersion: data.reviewManuscriptVersion || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        acceptedAt: data.acceptedAt || null,
        publishedAt: data.publishedAt || null,
      };
    });
    items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return NextResponse.json({ ok: true, assignments: items }, { status: 200 });
  } catch (e: any) {
    console.error('reviewer assignments error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
