-- Migration 0005: add name column to users
-- Bug fix: createUser expects a name column that was missing in 0003
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
