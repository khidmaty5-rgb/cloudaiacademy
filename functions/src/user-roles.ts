// Dependency-free canonical roles, shared with the Next application.
export const USER_ROLES = ['student', 'teacher', 'reviewer', 'editor', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
