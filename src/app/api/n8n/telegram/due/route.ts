import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/server/firebase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const secret = (req.headers.get('x-n8n-secret') || req.headers.get('X-N8N-SECRET') || '').trim();
    const expected = (process.env.N8N_WEBHOOK_SECRET || '').trim();
    if (!expected || secret !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const limitStr = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 100);

    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const now = new Date();

    const querySnap = await db
      .collection('tg_jobs')
      .where('status', '==', 'scheduled')
      .where('claimed', '==', false)
      .where('sendAt', '<=', now)
      .orderBy('sendAt', 'asc')
      .limit(limit)
      .get();

    const claimed: any[] = [];
    for (const d of querySnap.docs) {
      const ref = d.ref;
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const data = snap.data() as any;
          if (!data || data.status !== 'scheduled' || data.claimed) return;
          tx.update(ref, { claimed: true, claimedAt: FieldValue.serverTimestamp() });
          claimed.push({ id: snap.id, ...(data as any) });
        });
      } catch {}
    }

    const jobs = claimed.map((j) => ({
      jobId: j.id,
      providerId: j.providerId,
      chatId: j.chatId,
      payload: j.payload,
    }));

    return NextResponse.json({ ok: true, jobs }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
