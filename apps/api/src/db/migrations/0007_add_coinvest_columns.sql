-- Migration 0007: Add co-investor application columns to leads
-- Enables storing investor profile, experience, interests and consent metadata
-- for kind = 'investor_interest' submissions via the /coinvierte form.
--
-- All columns are nullable to preserve compatibility with existing rows.

DO $$ BEGIN
  ALTER TYPE lead_kind ADD VALUE 'investor_interest';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads
  ADD COLUMN profile             text,
  ADD COLUMN experience          text,
  ADD COLUMN interests           text,
  ADD COLUMN consent_version     text,
  ADD COLUMN consent_accepted_at timestamptz;

COMMENT ON COLUMN leads.profile IS 'Tipo de perfil inversor (kind = investor_interest)';
COMMENT ON COLUMN leads.experience IS 'Nivel de experiencia en inversión inmobiliaria (kind = investor_interest)';
COMMENT ON COLUMN leads.interests IS 'Intereses declarados por el inversor (kind = investor_interest)';
COMMENT ON COLUMN leads.consent_version IS 'Versión del consentimiento aceptado';
COMMENT ON COLUMN leads.consent_accepted_at IS 'Momento en el que se aceptó el consentimiento';
