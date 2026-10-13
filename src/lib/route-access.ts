import type { UserRole } from '@/lib/user-roles';
export type AppRole = UserRole;

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

export type RoutePolicy = {kind:'public'} | {kind:'authenticated'} |
  {kind:'roles';roles:readonly AppRole[]} | {kind:'denied'};

export function routePolicyForPath(pathname: string): RoutePolicy {
  const roles = (allowed:readonly AppRole[]):RoutePolicy => ({kind:'roles',roles:allowed});
  // /admin is the existing public staff login, not an administrative workspace.
  if (['/', '/login', '/signup', '/admin', '/courses', '/journal', '/journal/guidelines', '/print/qr',
    '/research', '/research/submit', '/research/standards', '/research/propose', '/research/partner',
    '/research/mentor', '/research/join'].includes(pathname) ||
    /^\/courses\/[^/]+$/.test(pathname) || /^\/journal\/articles\/[^/]+$/.test(pathname) ||
    /^\/verify\/[^/]+$/.test(pathname)) return {kind:'public'};
  if (pathname === '/admin/dashboard' || /^\/admin\/courses\/edit\/[^/]+$/.test(pathname) ||
    ['/teacher/dashboard','/teacher/courses','/teacher/telegram','/dashboard/telegram'].includes(pathname)) return roles(teachingRoles);
  if (pathname === '/admin/journal') return roles(editorialRoles);
  if (['/admin/users','/admin/users/new','/admin/courses','/admin/courses/new','/admin/waitlist',
    '/admin/certificates','/admin/analytics','/admin/academy','/admin/announcements','/admin/payment',
    '/admin/access','/admin/landing','/admin/seed'].includes(pathname)) return roles(['admin']);
  if (pathname === '/reviewer') return roles(reviewRoles);
  if (['/dashboard','/learning-path','/certificates'].includes(pathname)) return roles(learnerRoles);
  if (['/profile','/journal/submit','/journal/my-submissions'].includes(pathname) ||
    /^\/learn\/[^/]+(?:\/[^/]+)?$/.test(pathname) || /^\/journal\/revise\/[^/]+$/.test(pathname) ||
    /^\/live\/[^/]+$/.test(pathname)) return {kind:'authenticated'};
  // Unregistered routes are never implicitly authorized by a workspace guard.
  return {kind:'denied'};
}

export function allowedRolesForPath(pathname: string): readonly AppRole[] | null {
  const policy = routePolicyForPath(pathname);
  return policy.kind === 'public' ? null : policy.kind === 'authenticated' ? allAuthenticatedRoles :
    policy.kind === 'roles' ? policy.roles : [];
}

export function canRoleAccessPath(role: AppRole, pathname: string): boolean {
  const allowed = allowedRolesForPath(pathname);
  return allowed === null || allowed.includes(role);
}
