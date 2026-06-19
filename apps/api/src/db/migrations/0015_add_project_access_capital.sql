BEGIN;

ALTER TABLE project_user_access
  ADD COLUMN committed_amount_cents bigint NOT NULL DEFAULT 0 CHECK (committed_amount_cents >= 0),
  ADD COLUMN currency text NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  ADD COLUMN notes text;

CREATE INDEX project_user_access_committed_amount_idx
  ON project_user_access (opportunity_id, status, committed_amount_cents);

COMMIT;
