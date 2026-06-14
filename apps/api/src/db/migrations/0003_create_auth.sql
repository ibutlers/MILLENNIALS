-- Hito 3: Authentication and authorization schema.
-- Forward-only, non-destructive migration. Idempotent via IF NOT EXISTS.

-- ── Enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM (
    'pending_email_verification',
    'active',
    'suspended',
    'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('investor', 'operator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM (
    'account_created',
    'email_verified',
    'login_success',
    'login_failure',
    'logout',
    'session_revoked',
    'password_reset_requested',
    'password_reset_completed',
    'role_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  status user_status NOT NULL DEFAULT 'pending_email_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT users_email_normalized_check CHECK (email_normalized = lower(trim(email))),
  CONSTRAINT users_email_length_check CHECK (length(email) BETWEEN 5 AND 254),
  CONSTRAINT users_password_hash_length_check CHECK (length(password_hash) <= 512)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  CONSTRAINT sessions_revoked_after_created CHECK (revoked_at IS NULL OR revoked_at > created_at)
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type audit_event_type NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_token_hash_idx ON email_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS audit_events_user_id_idx ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS audit_events_event_type_idx ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events (created_at);

-- ── Triggers ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
