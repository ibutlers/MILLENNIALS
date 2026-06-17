-- 0012: Rename plugin table columns to camelCase (Better Auth v1.6.19 expectation)
--
-- Better Auth v1.6.19's plugin-generated tables (twoFactor, organization, member,
-- invitation) use camelCase column names directly. The adapter's field mappings
-- in the config (user.fields, session.fields, etc.) only apply to CORE model
-- tables — not to plugin-contributed tables.
--
-- Evidence: getSchema() from better-auth/db confirms that with field mappings
-- present, plugin tables still show camelCase column names (backupCodes, userId,
-- organizationId, expiresAt, inviterId, etc.)
--
-- This migration ALSO adds the missing session.activeOrganizationId mapping
-- and renames verification timestamp columns to camelCase.

BEGIN;

-- ── user table ─────────────────────────────────────────────────────────────
-- 0011 already renamed two_factor_enabled → "twoFactorEnabled"
-- No additional user column changes needed.

-- ── session: add missing activeOrganizationId mapping ──────────────────────
-- The session.active_organization_id column was NOT in the field mappings.
-- Rename to match Better Auth expectation.
ALTER TABLE auth.session RENAME COLUMN active_organization_id TO "activeOrganizationId";

-- ── verification: rename timestamp columns ─────────────────────────────────
-- Better Auth expects: expiresAt, createdAt, updatedAt (camelCase)
-- The verification.fields config mapping is NOT applied at runtime.
ALTER TABLE auth.verification RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE auth.verification RENAME COLUMN created_at TO "createdAt";
ALTER TABLE auth.verification RENAME COLUMN updated_at TO "updatedAt";

-- ── twoFactor: rename backup_codes and user_id ─────────────────────────────
ALTER TABLE auth.two_factor RENAME COLUMN backup_codes TO "backupCodes";
ALTER TABLE auth.two_factor RENAME COLUMN user_id TO "userId";

-- ── organization: rename created_at ────────────────────────────────────────
ALTER TABLE auth.organization RENAME COLUMN created_at TO "createdAt";

-- ── member: rename organization_id, user_id, created_at ────────────────────
ALTER TABLE auth.member RENAME COLUMN organization_id TO "organizationId";
ALTER TABLE auth.member RENAME COLUMN user_id TO "userId";
ALTER TABLE auth.member RENAME COLUMN created_at TO "createdAt";

-- ── invitation: rename organization_id, expires_at, created_at, inviter_id ─
ALTER TABLE auth.invitation RENAME COLUMN organization_id TO "organizationId";
ALTER TABLE auth.invitation RENAME COLUMN expires_at TO "expiresAt";
ALTER TABLE auth.invitation RENAME COLUMN created_at TO "createdAt";
ALTER TABLE auth.invitation RENAME COLUMN inviter_id TO "inviterId";

COMMIT;
