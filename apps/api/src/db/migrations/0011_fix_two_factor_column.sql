-- 0011: Fix twoFactorEnabled column name for Better Auth v1.6.19
--
-- Better Auth v1.6.19's twoFactor plugin adds `twoFactorEnabled` to the user
-- model but the user.fields mapping does NOT apply to plugin-contributed fields.
-- The column must match the plugin's camelCase default name.
--
-- Evidence: ERROR: column "twoFactorEnabled" of relation "user" does not exist
-- SQLSTATE 42703, from Kysely adapter INSERT at Better Auth v1.6.19 sign-up.
--
-- Only renaming this single column. Plugin tables (auth.two_factor,
-- auth.member, auth.invitation) use their own independent schema.

ALTER TABLE auth."user" RENAME COLUMN two_factor_enabled TO "twoFactorEnabled";

-- Update field mapping: now that the column matches the default name,
-- the mapping is a no-op identity. Keep it explicit for documentation.
-- `twoFactorEnabled: 'twoFactorEnabled'` or simply remove the entry.
