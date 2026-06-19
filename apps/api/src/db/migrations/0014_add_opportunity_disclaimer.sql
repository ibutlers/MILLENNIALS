BEGIN;

ALTER TABLE opportunities
  ADD COLUMN disclaimer text;

COMMIT;
