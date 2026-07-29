import type { User } from 'firebase/auth';
import type { Course, UserRole } from '@/types/models';

export type Role = UserRole | null;

export function roleFromClaims(claims: any): UserRole {
  const r = (claims?.role as string) || 'student';
  if (r === 'admin' || r === 'teacher' || r === 'editor' || r === 'reviewer') return r as UserRole;
  return 'student';
}

export const isAdmin = (role: Role) => role === 'admin';
export const isTeacher = (role: Role) => role === 'teacher';
export const isReviewer = (role: Role) => role === 'reviewer' || role === 'admin';
export const isEditor = (role: Role) => role === 'editor' || role === 'admin';
export const isStudent = (role: Role) => role === 'student';
export const isLearnerRole = (role: unknown): role is 'student' | 'reviewer' =>
  role === 'student' || role === 'reviewer';
export const shouldAutoCreateStudentProfile = (claimRole: unknown): boolean =>
  claimRole !== 'admin' &&
  claimRole !== 'teacher' &&
  claimRole !== 'reviewer' &&
  claimRole !== 'editor';

export function resolveCurrentRole(
  claimRole: UserRole,
  profileRole: UserRole | null,
  profileExists: boolean,
): UserRole {
  return profileExists ? profileRole ?? 'student' : claimRole;
}

export function canTeachCourse(course: Partial<Course> | undefined | null, uid?: string | null): boolean {
  if (!course || !uid) return false;
  if ((course.ownerId && course.ownerId === uid)) return true;
  const arr = (course.instructorIds as string[] | undefined) || [];
  return Array.isArray(arr) && arr.includes(uid);
}
