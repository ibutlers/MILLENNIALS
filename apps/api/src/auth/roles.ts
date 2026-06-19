/**
 * App user role constants
 *
 * Canonical role: operator (replaces legacy staff).
 * Legacy staff rows in the database are translated to operator
 * at the auth middleware level (admin/auth.ts).
 * The DB enum supports both values after migration 0020.
 */
export const APP_USER_ROLES = ['investor', 'operator', 'admin'] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

const VALID_ROLES: Set<string> = new Set(APP_USER_ROLES);

/** Check whether a role string is an accepted app user role. */
export function isAcceptedAppUserRole(role: string): role is AppUserRole {
  return VALID_ROLES.has(role);
}

/**
 * Normalise a role for database writes.
 * Legacy staff is accepted but written as operator.
 */
export function toDatabaseAppUserRole(role: string): AppUserRole {
  if (role === 'staff') return 'operator';
  if (isAcceptedAppUserRole(role)) return role;
  throw new Error('Unsupported role: ' + role);
}
