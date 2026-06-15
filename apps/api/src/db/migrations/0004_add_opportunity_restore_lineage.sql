-- Add lineage metadata for opportunities restored from historical versions.
-- This migration is additive and must be applied by the migration runner after 0003.

ALTER TABLE opportunities
  ADD COLUMN restored_from_opportunity_id uuid,
  ADD COLUMN restored_from_version integer,
  ADD CONSTRAINT opportunities_restored_from_opportunity_fk
    FOREIGN KEY (restored_from_opportunity_id) REFERENCES opportunities(id),
  ADD CONSTRAINT opportunities_restored_from_version_positive
    CHECK (restored_from_version IS NULL OR restored_from_version > 0),
  ADD CONSTRAINT opportunities_restore_lineage_complete
    CHECK (
      (restored_from_opportunity_id IS NULL AND restored_from_version IS NULL)
      OR
      (restored_from_opportunity_id IS NOT NULL AND restored_from_version IS NOT NULL)
    );

CREATE INDEX opportunities_restore_lineage_idx
  ON opportunities (restored_from_opportunity_id, restored_from_version);
