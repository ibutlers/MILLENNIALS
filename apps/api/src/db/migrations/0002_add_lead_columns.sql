-- Migration 0002: Add missing lead columns referenced by application code
-- The baseline (0001) omitted these columns that leads/repository.ts and
-- leads/schemas.ts have always referenced. This migration adds them without
-- modifying existing data or constraints.
--
-- All columns are nullable to preserve compatibility with existing rows.
-- The runner controls idempotency via schema_migrations checksum; this SQL
-- is deterministic and will fail cleanly if the pre-migration schema does
-- not match the expected baseline state.

ALTER TABLE leads
  ADD COLUMN phone                  text,
  ADD COLUMN country_code           text,
  ADD COLUMN investment_range       text,
  ADD COLUMN referrer               text,
  ADD COLUMN utm_source             text,
  ADD COLUMN utm_medium             text,
  ADD COLUMN utm_campaign           text,
  ADD COLUMN privacy_policy_version text,
  ADD COLUMN privacy_accepted_at    timestamptz,
  ADD COLUMN risk_acknowledged_at   timestamptz,
  ADD COLUMN marketing_opt_in_at    timestamptz;
