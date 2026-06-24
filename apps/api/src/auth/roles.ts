/**
 * App user role constants
 *
 * Canonical role: operator (replaces legacy staff).
 * Legacy staff rows in the database are translated to operator at API/UI
 * boundaries. The DB enum keeps staff only as backward-compatible storage.
 */
export const APP_USER_ROLES = ['investor', 'operator', 'admin'] as const;
export const LEGACY_APP_USER_ROLES = ['staff'] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];
export type LegacyAppUserRole = (typeof LEGACY_APP_USER_ROLES)[number];
export type AcceptedAppUserRoleInput = AppUserRole | LegacyAppUserRole;

const VALID_ROLES: Set<string> = new Set(APP_USER_ROLES);
const LEGACY_ROLES: Set<string> = new Set(LEGACY_APP_USER_ROLES);

/** Check whether a role string is a canonical app user role. */
export function isAcceptedAppUserRole(role: string): role is AppUserRole {
  return VALID_ROLES.has(role);
}

/** Check whether a role string is accepted as input, including legacy aliases. */
export function isAcceptedAppUserRoleInput(role: string): role is AcceptedAppUserRoleInput {
  return VALID_ROLES.has(role) || LEGACY_ROLES.has(role);
}

/**
 * Normalize any accepted role to the public/canonical role vocabulary.
 * `staff` is a legacy alias and must never be shown to users as a new role.
 */
export function normalizeAppUserRole(role: string): AppUserRole {
  if (role === 'staff') return 'operator';
  if (isAcceptedAppUserRole(role)) return role;
  throw new Error('Unsupported role: ' + role);
}

/**
 * Normalise a role for database writes.
 * Legacy staff is accepted but written as operator.
 */
export function toDatabaseAppUserRole(role: string): AppUserRole {
  return normalizeAppUserRole(role);
}

export function hasAppUserRole(actualRole: string, requiredRoles: string[]): boolean {
  const normalizedActual = normalizeAppUserRole(actualRole);
  return requiredRoles.some((role) => normalizeAppUserRole(role) === normalizedActual);
}
