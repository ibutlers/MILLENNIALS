BEGIN;

ALTER TABLE opportunities
  ADD COLUMN project_total_amount_cents bigint CHECK (project_total_amount_cents IS NULL OR project_total_amount_cents >= 0),
  ADD COLUMN bank_financing_amount_cents bigint CHECK (bank_financing_amount_cents IS NULL OR bank_financing_amount_cents >= 0);

COMMIT;
