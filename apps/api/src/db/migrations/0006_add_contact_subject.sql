-- Migration 0006: Add subject column to leads for contact form
-- Enables storing the contact reason/motivo independent of the lead kind enum.
-- The subject column is nullable; only contact form submissions set it.

ALTER TABLE leads
  ADD COLUMN subject text;

COMMENT ON COLUMN leads.subject IS 'Motivo de contacto (solo para kind = general_contact)';
