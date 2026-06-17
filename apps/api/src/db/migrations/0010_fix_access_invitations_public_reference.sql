-- Fix: add default for public_reference in access_invitations
-- The column was defined as NOT NULL without a default, causing INSERT failures
-- when the E2E helpers and invitation CLI don't provide it explicitly.
-- Default generates a short unique reference like "INV-a1b2c3d4".

ALTER TABLE access_invitations
  ALTER COLUMN public_reference SET DEFAULT 'INV-' || substr(gen_random_uuid()::text, 1, 8);
