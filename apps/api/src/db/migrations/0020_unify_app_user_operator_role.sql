-- 0020_unify_app_user_operator_role.sql
-- Canonical role nomenclature is operator. Keep legacy staff enum value for
-- already-deployed databases/rollback compatibility, but allow new writes to
-- store operator directly without failing casts to app_user_role.

ALTER TYPE app_user_role ADD VALUE IF NOT EXISTS 'operator';
