import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export const runtime = 'nodejs';

function getAdminAppWithCert(): App | null {
  const name = 'adminAppCertificatesList';
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

function decodeTokenPayload(idToken: string) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  return JSON.parse(
    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );
}

async function verifyIdTokenOrDecode(idToken: string) {
  const app = getAdminAppWithCert();
  if (app) {
    try {
      return await getAuth(app).verifyIdToken(idToken);
    } catch (e) {
      if (process.env.NODE_ENV === 'production') throw e;
      return decodeTokenPayload(idToken);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return decodeTokenPayload(idToken);
  }

  throw new Error('Server auth is not configured');
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
    const idToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try {
      decoded = await verifyIdTokenOrDecode(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (decoded?.role as string | undefined) || 'student';
    const isStaff = role === 'admin' || role === 'teacher';
    if (!isStaff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const app = getAdminAppWithCert();
    if (!app) return NextResponse.json({ error: 'Server auth is not configured' }, { status: 500 });

    const rawLimit = req.nextUrl.searchParams.get('limit') || '100';
    const limit = Math.max(1, Math.min(500, Number.parseInt(rawLimit, 10) || 100));

    const rawStartAfter = req.nextUrl.searchParams.get('startAfter') || '';
    const startAfterId = rawStartAfter.trim();

    let q = getFirestore(app).collection('certificates').orderBy('issuedAt', 'desc').limit(limit);
    if (startAfterId) {
      const cursorSnap = await getFirestore(app).doc(`certificates/${startAfterId}`).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    const snap = await q.get();
    const certificates = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        userId: data?.userId || '',
        userName: data?.userName || '',
        courseId: data?.courseId || '',
        courseTitle: data?.courseTitle || '',
        courseCode: data?.courseCode || '',
        status: data?.status || '',
        issuedAtMillis: toMillis(data?.issuedAt),
        completedAtMillis: toMillis(data?.completedAt),
        pdfPath: data?.pdfPath || null,
      };
    });

    const nextCursor = certificates.length ? certificates[certificates.length - 1].id : null;

    return NextResponse.json({ ok: true, certificates, nextCursor }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

