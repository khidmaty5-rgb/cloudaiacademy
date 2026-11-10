import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { lectureActor, lectureError, readBoundedBody, requireLectureAdmin } from '@/server/lecture-resources';
import { openCourseRecord } from '@/server/open-courses';
import { validOpenCourseId } from '@/lib/open-course-management';

export const dynamic = 'force-dynamic';
const opts = { headers: { 'Cache-Control': 'private, no-store' } };
export async function GET(req: Request) {
  try {
    const { uid, role } = await lectureActor(req);
    if (role !== 'teacher' && role !== 'admin') throw Error('FORBIDDEN');
    const docs = await getFirebaseAdminFirestore().collection('openAssignmentStaff').where('teacherUid','==',uid).get();
    const items = await Promise.all(docs.docs.map(async d => {
      try { const c = await openCourseRecord(d.id); return { id: d.id, title: c.title }; }
      catch(e) { if (e instanceof Error && e.message === 'NOT_FOUND') return null; throw e; }
    }));
    return Response.json({ items: items.filter(Boolean) }, opts);
  } catch(e) { return lectureError(e); }
}
export async function PUT(req: Request) {
  try {
    await requireLectureAdmin(req);
    const { courseId, email } = JSON.parse((await readBoundedBody(req, 2048)).toString());
    if (typeof courseId !== 'string' || !validOpenCourseId(courseId) || typeof email !== 'string' || email.length > 254) throw Error('INVALID_REQUEST');
    await openCourseRecord(courseId);
    const db = getFirebaseAdminFirestore();
    const ref = db.doc('openAssignmentStaff/'+courseId);
    if (email === '') await ref.delete();
    else {
      const teacher = await getFirebaseAdminAuth().getUserByEmail(email.trim());
      if (teacher.disabled || (await db.doc('users/'+teacher.uid).get()).data()?.role !== 'teacher') throw Error('INVALID_REQUEST');
      await ref.set({ teacherUid: teacher.uid });
    }
    return Response.json({ ok: true }, opts);
  } catch(e) { return lectureError(e); }
}
