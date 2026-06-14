-- Hito 2: public real estate opportunities schema.
-- Forward-only, non-destructive initial migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE opportunity_status AS ENUM (
    'coming_soon',
    'open',
    'funding',
    'funded',
    'in_execution',
    'commercializing',
    'closed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_visibility AS ENUM ('public', 'private', 'unlisted', 'draft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_risk_level AS ENUM ('low', 'medium', 'high', 'very_high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_return_type AS ENUM (
    'target_annual_return',
    'target_total_return',
    'target_irr',
    'target_roi'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_media_type AS ENUM ('image', 'floorplan', 'map', 'document_preview');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  short_description text NOT NULL,
  description text NOT NULL,
  city text NOT NULL,
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  district text,
  asset_type text NOT NULL,
  strategy text NOT NULL,
  status opportunity_status NOT NULL,
  visibility opportunity_visibility NOT NULL DEFAULT 'draft',
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  target_amount_cents bigint NOT NULL CHECK (target_amount_cents > 0),
  committed_amount_cents bigint NOT NULL DEFAULT 0 CHECK (committed_amount_cents >= 0),
  minimum_investment_cents bigint NOT NULL CHECK (minimum_investment_cents > 0),
  estimated_term_months integer NOT NULL CHECK (estimated_term_months > 0),
  target_return_type opportunity_return_type NOT NULL,
  target_return_bps integer CHECK (target_return_bps IS NULL OR target_return_bps >= 0),
  risk_level opportunity_risk_level NOT NULL,
  closing_date date,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_committed_not_extreme CHECK (committed_amount_cents <= target_amount_cents * 2)
);

CREATE INDEX IF NOT EXISTS opportunities_public_catalog_idx
  ON opportunities (visibility, published_at DESC, status, city, asset_type, strategy, risk_level);

CREATE TABLE IF NOT EXISTS opportunity_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  type opportunity_media_type NOT NULL,
  url text NOT NULL,
  alt_text text NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, position, url)
);

CREATE TABLE IF NOT EXISTS opportunity_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE (opportunity_id, position, label)
);

CREATE TABLE IF NOT EXISTS opportunity_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE (opportunity_id, position, title)
);

CREATE TABLE IF NOT EXISTS opportunity_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  planned_date date,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  UNIQUE (opportunity_id, position, title)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opportunities_set_updated_at ON opportunities;
CREATE TRIGGER opportunities_set_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
