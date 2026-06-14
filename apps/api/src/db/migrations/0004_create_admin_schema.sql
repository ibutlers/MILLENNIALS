-- Hito 6: Admin schema — additive, non-destructive, idempotent.

BEGIN;

-- 1. Extend audit_event_type enum with admin events
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_created'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_updated'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_status_changed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_published'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_unpublished'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'opportunity_archived'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'lead_assigned'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'lead_note_added'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'user_suspended'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'user_reactivated'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE audit_event_type ADD VALUE 'session_admin_revoked'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Optimistic concurrency: version columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 3. Opportunities: editorial workflow
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS editorial_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add editorial_status constraint (guarded against duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_editorial_status_check'
  ) THEN
    ALTER TABLE opportunities ADD CONSTRAINT opportunities_editorial_status_check
      CHECK (editorial_status IN ('draft','review','published','unlisted','private','archived'));
  END IF;
END $$;

-- 4. Leads: assignment and notes
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL CHECK (length(content) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON lead_notes (lead_id);

-- 5. Opportunity version history
CREATE TABLE IF NOT EXISTS opportunity_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, version)
);
CREATE INDEX IF NOT EXISTS opportunity_versions_opp_id_idx ON opportunity_versions (opportunity_id);

COMMIT;
