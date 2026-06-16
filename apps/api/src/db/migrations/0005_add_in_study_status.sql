-- Add 'in_study' status to opportunity_status enum
-- Realstate 0005: support projects in study phase (Vigo real projects)
DO $$ BEGIN
  ALTER TYPE opportunity_status ADD VALUE 'in_study';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
