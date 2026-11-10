import 'server-only';
import { openCourseRecord } from '@/server/open-courses';
import { lectureIdValid } from '@/lib/lecture-resources';

import { lectureActor, requireLectureAdmin } from '@/server/lecture-resources';
import { getFirebaseAdminFirestore } from '@/server/firebase-admin';
import { isPriceFree } from '@/lib/course-price';
import { isLearnerRole, canTeachCourse } from '@/lib/roles';
// Separate namespace: assignment instructions never contain student answers.
export async function resourceScope(request: Request, manage: boolean) {
  const courseId = new URL(request.url).searchParams.get('courseId');
  if (new URL(request.url).searchParams.get('kind') === 'regular') {
    if (!courseId || !/^[\w-]{1,180}$/.test(courseId)) throw new Error('NOT_FOUND');
    const { uid, role, profile } = await lectureActor(request);
    const db = getFirebaseAdminFirestore();
    const course = (await db.doc('courses/'+courseId).get()).data();
    if (!course) throw new Error('NOT_FOUND');
    if (!(role === 'admin' || (role === 'teacher' && canTeachCourse(course, uid)))) {
      if (manage || !isLearnerRole(role) || course.status !== 'PUBLISHED') throw new Error('FORBIDDEN');
      if (!(await db.doc('users/'+uid+'/enrollments/'+courseId).get()).exists) throw new Error('FORBIDDEN');
      if (!isPriceFree(course.price)) {
        const policy = (await db.doc('settings/payment').get()).data()?.paywall;
        if (policy?.enabled === true && (policy.defaultRequirePayment === true ? profile?.requirePayment !== false : profile?.requirePayment === true)
          && !(await db.doc('users/'+uid+'/coursePurchases/'+courseId).get()).exists) throw new Error('FORBIDDEN');
      }
    }
    return { uid, collection: 'regularAssignmentResources/'+courseId+'/items', prefix: 'regular-course-assignments/'+courseId };
  }
  if (!courseId) return { uid: manage ? await requireLectureAdmin(request) : undefined, collection: 'lectureResources', prefix: 'lecture-resources' };
  if (courseId !== 'number-systems' && !lectureIdValid(courseId)) throw new Error('NOT_FOUND');
  const actor = manage ? await lectureActor(request) : null;
  if (actor && actor.role !== 'admin' && (actor.role !== 'teacher' || (await getFirebaseAdminFirestore().doc('openAssignmentStaff/'+courseId).get()).data()?.teacherUid !== actor.uid)) throw new Error('FORBIDDEN');
  const course = await openCourseRecord(courseId);
  if (!manage && !course.published) throw new Error('NOT_FOUND');
  return { uid: actor?.uid, collection: `courseAssignmentResources/${courseId}/items`, prefix: `course-assignments/${courseId}` };
}
