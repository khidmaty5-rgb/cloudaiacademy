import type { UserRole } from '@/lib/user-roles';

// UI affordances only: server authorization, enrollment and ownership still apply.
export const capabilityRoles = {
  'academy.overview': ['admin'],
  'academy.manageCourses': ['admin'],
  'academy.manageUsers': ['admin'],
  'academy.manageEnrollments': ['admin'],
  'academy.manageCertificates': ['admin'],
  'academy.viewAnalytics': ['admin'],
  'academy.manageSettings': ['admin'],
  'academy.managePayments': ['admin'],
  'learning.access': ['student', 'reviewer'],
  'learning.certificates': ['student', 'reviewer'],
  'course.teach': ['teacher', 'admin'],
  'course.manageAssigned': ['teacher', 'admin'],
  'journal.review': ['reviewer', 'editor', 'admin'],
  'journal.edit': ['editor', 'admin'],
  'communications.telegram': ['teacher', 'admin'],
  'journal.submit': ['student', 'teacher', 'reviewer', 'editor', 'admin'],
  'academy.discover': ['student', 'teacher', 'reviewer', 'editor', 'admin'],
  'account.profile': ['student', 'teacher', 'reviewer', 'editor', 'admin'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Capability = keyof typeof capabilityRoles;

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return (capabilityRoles[capability] as readonly UserRole[]).includes(role);
}

export function capabilitiesForRole(role: UserRole): Capability[] {
  return (Object.keys(capabilityRoles) as Capability[]).filter(capability => hasCapability(role, capability));
}
