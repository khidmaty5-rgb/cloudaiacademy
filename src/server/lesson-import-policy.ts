export function canManageLessonImport(role: unknown, uid: string, course: Record<string, unknown>) {
  return role === 'admin' || (role === 'teacher' && (course.ownerId === uid || (Array.isArray(course.instructorIds) && course.instructorIds.includes(uid))));
}
