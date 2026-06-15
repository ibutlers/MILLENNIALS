-- ============================================================================
-- BASELINE 0001 — Definitive schema for MILLENNIALS CONSTRUYEN | CAPITAL
-- Replaces incremental migrations 0001–0006 with a single clean model.
-- All tables, enums, constraints, and indexes in one file.
-- ============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Opportunity enums
DO $$ BEGIN CREATE TYPE opportunity_status AS ENUM (
  'coming_soon','open','funding','funded','in_execution','commercializing','closed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE opportunity_visibility AS ENUM (
  'public','private','unlisted','draft'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE opportunity_risk_level AS ENUM (
  'low','medium','high','very_high'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE opportunity_return_type AS ENUM (
  'target_annual_return','target_total_return','target_irr','target_roi'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE opportunity_media_type AS ENUM (
  'image','floorplan','map','document_preview'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Identity enums
DO $$ BEGIN CREATE TYPE user_status AS ENUM (
  'pending_email_verification','active','suspended','deactivated'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_role AS ENUM (
  'investor','operator','admin'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lead enums
DO $$ BEGIN CREATE TYPE lead_kind AS ENUM (
  'access_request','opportunity_inquiry','general_contact'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE lead_status AS ENUM (
  'new','in_review','contacted','qualified','closed','rejected'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Audit enums
DO $$ BEGIN CREATE TYPE audit_event_type AS ENUM (
  'account_created','email_verified','login_success','login_failure','logout',
  'session_revoked','password_reset_requested','password_reset_completed',
  'role_changed','opportunity_created','opportunity_updated',
  'opportunity_status_changed','opportunity_published','opportunity_unpublished',
  'opportunity_archived','lead_assigned','lead_note_added',
  'user_suspended','user_reactivated','session_admin_revoked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Investor enums
DO $$ BEGIN CREATE TYPE investor_status AS ENUM (
  'onboarding','active','suspended','closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE kyc_status AS ENUM (
  'not_started','in_review','approved','rejected','expired'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE document_type AS ENUM (
  'pitch_deck','financial_model','legal_document','due_diligence','compliance','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE document_status AS ENUM (
  'draft','active','superseded','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE investment_status AS ENUM (
  'intent','under_review','accepted','cancelled','rejected'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE position_status AS ENUM (
  'active','exited','written_off'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE outbox_status AS ENUM (
  'pending','sent','failed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE consent_type AS ENUM (
  'privacy_policy','terms_of_service','marketing','data_processing'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE editorial_status AS ENUM (
  'draft','review','published','unlisted','private','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLES — Content
-- ============================================================================

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference text NOT NULL UNIQUE,
  email           text NOT NULL UNIQUE
    CHECK (length(email) >= 5 AND length(email) <= 254),
  email_normalized text NOT NULL UNIQUE
    CHECK (email_normalized = lower(trim(both from email))),
  password_hash   text CHECK (length(password_hash) <= 512),
  name            text,
  status          user_status NOT NULL DEFAULT 'pending_email_verification',
  email_verified_at timestamptz,
  last_login_at   timestamptz,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_status_idx ON users (status);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── User roles ─────────────────────────────────────────────────────────────
CREATE TABLE user_roles (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      user_role NOT NULL,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- ── Sessions ───────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

-- ── Email verification tokens ──────────────────────────────────────────────
CREATE TABLE email_verification_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);

-- ── Password reset tokens ──────────────────────────────────────────────────
CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);

-- ── Opportunities ──────────────────────────────────────────────────────────
CREATE TABLE opportunities (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     text NOT NULL UNIQUE,
  title                    text NOT NULL,
  short_description        text NOT NULL,
  description              text NOT NULL DEFAULT '',
  city                     text NOT NULL,
  country_code             text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  district                 text,
  asset_type               text NOT NULL,
  strategy                 text NOT NULL,
  status                   opportunity_status NOT NULL DEFAULT 'coming_soon',
  visibility               opportunity_visibility NOT NULL DEFAULT 'draft',
  currency                 text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  target_amount_cents      bigint NOT NULL CHECK (target_amount_cents > 0),
  committed_amount_cents   bigint NOT NULL DEFAULT 0 CHECK (committed_amount_cents >= 0),
  minimum_investment_cents bigint NOT NULL CHECK (minimum_investment_cents > 0),
  estimated_term_months    integer NOT NULL CHECK (estimated_term_months > 0),
  target_return_type       opportunity_return_type NOT NULL,
  target_return_bps        integer CHECK (target_return_bps IS NULL OR target_return_bps >= 0),
  risk_level               opportunity_risk_level NOT NULL DEFAULT 'medium',
  closing_date             date,
  published_at             timestamptz,
  version                  integer NOT NULL DEFAULT 1,
  editorial_status         editorial_status NOT NULL DEFAULT 'draft',
  updated_by               uuid REFERENCES users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_committed_not_extreme CHECK (committed_amount_cents <= target_amount_cents * 2)
);
CREATE UNIQUE INDEX opportunities_slug_idx ON opportunities (slug);
CREATE INDEX opportunities_public_catalog_idx ON opportunities (visibility, published_at DESC, status, city, asset_type, strategy, risk_level);
CREATE TRIGGER opportunities_set_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Opportunity sub-entities ───────────────────────────────────────────────
CREATE TABLE opportunity_media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  type           opportunity_media_type NOT NULL,
  url            text NOT NULL,
  alt_text       text,
  position       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_media_opportunity_id_idx ON opportunity_media (opportunity_id, position);

CREATE TABLE opportunity_highlights (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  label          text NOT NULL,
  value          text NOT NULL,
  position       integer NOT NULL DEFAULT 0
);
CREATE INDEX opportunity_highlights_opportunity_id_idx ON opportunity_highlights (opportunity_id, position);

CREATE TABLE opportunity_risks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  position       integer NOT NULL DEFAULT 0
);
CREATE INDEX opportunity_risks_opportunity_id_idx ON opportunity_risks (opportunity_id, position);

CREATE TABLE opportunity_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  planned_date   date,
  completed_at   timestamptz,
  position       integer NOT NULL DEFAULT 0
);
CREATE INDEX opportunity_milestones_opportunity_id_idx ON opportunity_milestones (opportunity_id, position);

-- ── Opportunity updates (project updates / news) ───────────────────────────
CREATE TABLE opportunity_updates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  title          text NOT NULL,
  body           text NOT NULL,
  published_at   timestamptz,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_updates_opportunity_id_idx ON opportunity_updates (opportunity_id, published_at DESC);
CREATE TRIGGER opportunity_updates_set_updated_at BEFORE UPDATE ON opportunity_updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Opportunity versions (edit history) ────────────────────────────────────
CREATE TABLE opportunity_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  snapshot       jsonb NOT NULL,
  changed_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX opportunity_versions_opp_version_idx ON opportunity_versions (opportunity_id, version);

-- ============================================================================
-- TABLES — Investor
-- ============================================================================

-- ── Investor profiles ──────────────────────────────────────────────────────
CREATE TABLE investor_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status          investor_status NOT NULL DEFAULT 'onboarding',
  kyc_status      kyc_status NOT NULL DEFAULT 'not_started',
  eligibility     text,
  phone           text,
  nationality     text CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$'),
  tax_residency   text CHECK (tax_residency IS NULL OR tax_residency ~ '^[A-Z]{2}$'),
  accredited      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER investor_profiles_set_updated_at BEFORE UPDATE ON investor_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Consents (versioned) ───────────────────────────────────────────────────
CREATE TABLE consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            consent_type NOT NULL,
  version         text NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  UNIQUE (user_id, type, version)
);
CREATE INDEX consents_user_id_idx ON consents (user_id);

-- ============================================================================
-- TABLES — Leads
-- ============================================================================

CREATE TABLE leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference text NOT NULL UNIQUE,
  kind             lead_kind NOT NULL,
  opportunity_id   uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  email            text NOT NULL,
  first_name       text,
  last_name        text,
  message          text,
  source_path      text,
  status           lead_status NOT NULL DEFAULT 'new',
  assigned_user_id uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_kind_status_idx ON leads (kind, status);
CREATE INDEX leads_assigned_user_id_idx ON leads (assigned_user_id);
CREATE INDEX leads_opportunity_id_idx ON leads (opportunity_id);
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE lead_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES users(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_notes_lead_id_idx ON lead_notes (lead_id);
CREATE INDEX lead_notes_author_id_idx ON lead_notes (author_id);

-- ============================================================================
-- TABLES — Documents
-- ============================================================================

CREATE TABLE documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type      text NOT NULL CHECK (owner_type IN ('opportunity','investor','general')),
  owner_id        uuid,
  type            document_type NOT NULL,
  title           text NOT NULL,
  status          document_status NOT NULL DEFAULT 'draft',
  version         integer NOT NULL DEFAULT 1,
  file_hash       text,
  storage_ref     text,
  mime_type       text,
  byte_size       bigint,
  visibility      opportunity_visibility NOT NULL DEFAULT 'private',
  uploaded_by     uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_owner_idx ON documents (owner_type, owner_id);
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLES — Investment
-- ============================================================================

CREATE TABLE investment_intents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid NOT NULL REFERENCES opportunities(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  amount_cents      bigint NOT NULL CHECK (amount_cents > 0),
  currency          text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status            investment_status NOT NULL DEFAULT 'intent',
  external_ref      text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  cancelled_at      timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, user_id)
);
CREATE INDEX investment_intents_opportunity_id_idx ON investment_intents (opportunity_id);
CREATE INDEX investment_intents_user_id_idx ON investment_intents (user_id);
CREATE TRIGGER investment_intents_set_updated_at BEFORE UPDATE ON investment_intents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLES — Portfolio
-- ============================================================================

CREATE TABLE portfolio_positions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id),
  status          position_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);
CREATE INDEX portfolio_positions_user_id_idx ON portfolio_positions (user_id);

CREATE TABLE portfolio_contributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   uuid NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  amount_cents  bigint NOT NULL CHECK (amount_cents > 0),
  currency      text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contributed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_contributions_position_id_idx ON portfolio_contributions (position_id);

CREATE TABLE portfolio_distributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id     uuid NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  currency        text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  distribution_type text NOT NULL CHECK (distribution_type IN ('dividend','capital_return','interest','other')),
  distributed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_distributions_position_id_idx ON portfolio_distributions (position_id);

CREATE TABLE portfolio_valuations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   uuid NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  value_cents   bigint NOT NULL,
  currency      text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  valued_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_valuations_position_id_idx ON portfolio_valuations (position_id);

CREATE TABLE portfolio_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   uuid NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_events_position_id_idx ON portfolio_events (position_id);

-- ============================================================================
-- TABLES — Operations
-- ============================================================================

-- ── Audit events ───────────────────────────────────────────────────────────
CREATE TABLE audit_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       audit_event_type NOT NULL,
  user_id          uuid REFERENCES users(id),
  entity_type      text,
  entity_id        text,
  entity_reference text,
  summary          text,
  metadata         jsonb NOT NULL DEFAULT '{}',
  ip_address       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_event_type_idx ON audit_events (event_type);
CREATE INDEX audit_events_user_id_idx ON audit_events (user_id);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id);
CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC);

-- ── Outbox ─────────────────────────────────────────────────────────────────
CREATE TABLE outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       text NOT NULL CHECK (channel IN ('email','push','webhook')),
  recipient     text NOT NULL,
  subject       text,
  body          text NOT NULL,
  status        outbox_status NOT NULL DEFAULT 'pending',
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_status_scheduled_idx ON outbox (status, scheduled_at);

-- ── Background jobs ────────────────────────────────────────────────────────
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 3,
  last_error    text,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_status_locked_idx ON jobs (status, locked_until);

-- ── Feature configuration ──────────────────────────────────────────────────
CREATE TABLE feature_flags (
  key           text PRIMARY KEY,
  value         text NOT NULL,
  description   text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE — Migration tracking (created by runner if not exists)
-- ============================================================================


-- ============================================================================
-- END OF BASELINE 0001 — schema_migrations tracking is managed by the runner.
-- NEVER modify this file after it has been applied. Future changes → 0002_*.sql
