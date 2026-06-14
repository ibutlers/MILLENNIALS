-- Migration 0006: add audit metadata columns needed by admin dashboard and audit log
-- Bug fix: audit_events missing entity_type, entity_reference, summary used by admin routes

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS entity_reference TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE INDEX IF NOT EXISTS audit_events_entity_type_idx ON audit_events (entity_type);
