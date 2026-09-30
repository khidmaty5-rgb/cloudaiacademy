export type AppRole = 'student' | 'teacher' | 'reviewer' | 'editor' | 'admin';

export const allAuthenticatedRoles: readonly AppRole[] = [
  'student',
  'teacher',
  'reviewer',
  'editor',
  'admin',
] as const;

const learnerRoles: readonly AppRole[] = ['student', 'reviewer'];
const teachingRoles: readonly AppRole[] = ['teacher', 'admin'];
const editorialRoles: readonly AppRole[] = ['editor', 'admin'];
const reviewRoles: readonly AppRole[] = ['reviewer', 'editor', 'admin'];

export function roleHomePath(role: AppRole): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'editor') return '/admin/journal';
  if (role === 'teacher') return '/teacher/dashboard';
  if (role === 'reviewer') return '/reviewer';
  return '/dashboard';
}

export function allowedRolesForPath(pathname: string): readonly AppRole[] | null {
  if (pathname === '/admin') return null;
  if (pathname === '/admin/dashboard' || pathname.startsWith('/admin/courses/edit/')) {
    return teachingRoles;
  }
  if (pathname === '/admin/journal' || pathname.startsWith('/admin/journal/')) {
    return editorialRoles;
  }
  if (pathname.startsWith('/admin/')) return ['admin'];
  if (pathname.startsWith('/teacher/')) return teachingRoles;
  if (pathname === '/reviewer' || pathname.startsWith('/reviewer/')) return reviewRoles;
  if (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/learning-path' ||
    pathname === '/certificates'
  ) {
    return learnerRoles;
  }
  if (pathname === '/profile' || pathname.startsWith('/learn/')) {
    return allAuthenticatedRoles;
  }
  return null;
}

export function canRoleAccessPath(role: AppRole, pathname: string): boolean {
  const allowed = allowedRolesForPath(pathname);
  return allowed === null || allowed.includes(role);
}
