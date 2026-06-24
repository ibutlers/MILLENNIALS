export function normalizeAuthRole(role: string): string {
  return role === 'staff' ? 'operator' : role;
}

export function normalizeAuthRoles(roles: string[] | undefined): string[] {
  const normalized = (roles && roles.length > 0 ? roles : ['investor']).map(normalizeAuthRole);
  return Array.from(new Set(normalized));
}

export function hasAnyRole(userRoles: string[] | undefined, requiredRoles: string[]): boolean {
  const normalizedUserRoles = normalizeAuthRoles(userRoles);
  const normalizedRequiredRoles = normalizeAuthRoles(requiredRoles);
  return normalizedRequiredRoles.some((role) => normalizedUserRoles.includes(role));
}
