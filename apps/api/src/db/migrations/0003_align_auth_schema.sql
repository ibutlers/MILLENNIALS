-- Migration 0003: Align authentication schema with the definitive runtime contract
--
-- Responsibilities:
--   * Sessions store a user-agent hash, never the full user-agent string.
--   * Sessions track last_seen_at separately from created_at.
--   * Verification/reset tokens store hashes only and support single-use consumption.
--   * Audit events keep the generic entity model; no session-specific audit columns.
--
-- Deterministic by design: the migration runner owns idempotency and checksum
-- validation. This migration must fail if the database is not exactly at the
-- expected 0001 + 0002 schema state.

ALTER TABLE sessions RENAME COLUMN user_agent TO user_agent_hash;
ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz;
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at DESC) WHERE revoked_at IS NULL;

ALTER TABLE email_verification_tokens RENAME COLUMN token TO token_hash;
ALTER TABLE email_verification_tokens ADD COLUMN consumed_at timestamptz;
CREATE INDEX email_verification_tokens_user_active_idx
  ON email_verification_tokens (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE password_reset_tokens RENAME COLUMN token TO token_hash;
ALTER TABLE password_reset_tokens RENAME COLUMN used_at TO consumed_at;
CREATE INDEX password_reset_tokens_user_active_idx
  ON password_reset_tokens (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;
