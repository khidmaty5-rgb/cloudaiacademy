import { NextRequest, NextResponse } from 'next/server';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { isValidCourseCode, normalizeCourseCode } from '@/lib/certificates';

export const runtime = 'nodejs';

function getAdminAppWithCert(): App | null {
  const name = 'adminAppCertificatesNextSequence';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '') : undefined;
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

function parseYear(input: unknown): number | null {
  const year = typeof input === 'number' ? input : Number.parseInt(String(input || ''), 10);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) return null;
  return year;
}

function parseCourseCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = normalizeCourseCode(input);
  if (!isValidCourseCode(code)) return null;
  return code;
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body?.year);
    const courseCode = parseCourseCode(body?.courseCode);
    if (!year) return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    if (!courseCode) return NextResponse.json({ error: 'Invalid courseCode' }, { status: 400 });

    const app = getAdminAppWithCert();
    if (!app) return NextResponse.json({ error: 'Server auth is not configured' }, { status: 500 });

    const prefix = 'CA';
    const counterId = `${prefix}-${year}-${courseCode}`;

    const db = getFirestore(app);
    const counterRef = db.collection('certificateCounters').doc(counterId);

    const nextSequence = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const raw = snap.exists ? snap.get('last') : 0;
      const last =
        typeof raw === 'number' && Number.isFinite(raw)
          ? raw
          : Number.parseInt(typeof raw === 'string' ? raw : String(raw || ''), 10) || 0;

      let candidate = Math.max(0, last) + 1;
      const maxAttempts = 50;
      const sequenceWidth = 6;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const padded = String(candidate).padStart(sequenceWidth, '0');
        const candidateId = `${prefix}-${year}-${courseCode}-${padded}`;
        const certRef = db.collection('certificates').doc(candidateId);
        const certSnap = await tx.get(certRef);
        if (!certSnap.exists) {
          tx.set(
            counterRef,
            {
              prefix,
              year,
              courseCode,
              last: candidate,
              ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          return candidate;
        }
        candidate += 1;
      }

      throw new Error('Could not allocate a unique sequence number. Please try again.');
    });

    return NextResponse.json({ ok: true, sequence: nextSequence, counterId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
