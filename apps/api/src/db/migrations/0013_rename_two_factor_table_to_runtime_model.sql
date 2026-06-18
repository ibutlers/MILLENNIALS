-- 0013: Rename two-factor plugin table to Better Auth v1.6.19 runtime model name
--
-- Evidence: the two-factor plugin option `twoFactorTable` only affects part of
-- the plugin schema. The bundled TOTP and backup-code submodules hardcode the
-- adapter model name `twoFactor`, so runtime queries fail with SQLSTATE 42P01
-- (`relation "twoFactor" does not exist`) when the table is named two_factor.
--
-- This migration preserves data and aligns the physical table name with the
-- exact runtime model used by Better Auth v1.6.19.

ALTER TABLE auth.two_factor RENAME TO "twoFactor";
