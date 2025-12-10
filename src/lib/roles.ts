import type { User } from 'firebase/auth';
import type { Course, UserRole } from '@/types/models';

export type Role = UserRole | null;

export function roleFromClaims(claims: any): UserRole {
  const r = (claims?.role as string) || 'student';
  if (r === 'admin' || r === 'teacher') return r;
  return 'student';
}

export const isAdmin = (role: Role) => role === 'admin';
export const isTeacher = (role: Role) => role === 'teacher';
export const isStudent = (role: Role) => role === 'student';

export function canTeachCourse(course: Partial<Course> | undefined | null, uid?: string | null): boolean {
  if (!course || !uid) return false;
  if ((course.ownerId && course.ownerId === uid)) return true;
  const arr = (course.instructorIds as string[] | undefined) || [];
  return Array.isArray(arr) && arr.includes(uid);
}
