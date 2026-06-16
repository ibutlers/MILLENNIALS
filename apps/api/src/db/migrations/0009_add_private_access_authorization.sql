-- Migration 0009: Private access authorization layer
-- Tablas de negocio para autorización local, independientes de Better Auth.
-- Vinculación mediante app_users.better_auth_user_id → auth.user.id
--
-- Principios:
--   - Better Auth gestiona identidad y sesiones
--   - La aplicación gestiona autorización y ciclo de vida del inversor
--   - Nunca se consultan tablas auth.* desde la lógica de negocio
--   - app_users es la fuente de verdad para roles, estado y permisos

BEGIN;

-- ── Enums locales ──────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE app_user_role AS ENUM (
  'investor', 'staff', 'admin'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE app_user_status AS ENUM (
  'pending_email', 'pending_mfa', 'active', 'suspended', 'revoked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE invitation_status AS ENUM (
  'pending', 'accepted', 'expired', 'revoked', 'failed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE project_access_status AS ENUM (
  'active', 'revoked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabla: app_users ───────────────────────────────────────────────────────
-- Usuario interno de la aplicación. Vinculado 1:1 con Better Auth user.
-- Contiene rol de negocio, estado del ciclo de vida y perfil de inversor.
CREATE TABLE app_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  better_auth_user_id text NOT NULL UNIQUE,
  email_normalized    text NOT NULL UNIQUE
    CHECK (email_normalized = lower(trim(both from email_normalized))),
  display_name        text,
  role                app_user_role NOT NULL DEFAULT 'investor',
  status              app_user_status NOT NULL DEFAULT 'pending_email',
  investor_profile_id uuid REFERENCES investor_profiles(id) ON DELETE SET NULL,
  email_verified_at   timestamptz,
  mfa_enabled_at      timestamptz,
  activated_at        timestamptz,
  suspended_at        timestamptz,
  revoked_at          timestamptz,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_better_auth_user_id_unique UNIQUE (better_auth_user_id)
);
CREATE INDEX app_users_status_idx ON app_users (status);
CREATE INDEX app_users_role_idx ON app_users (role);
CREATE INDEX app_users_better_auth_id_idx ON app_users (better_auth_user_id);
CREATE TRIGGER app_users_set_updated_at BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Tabla: access_invitations ──────────────────────────────────────────────
-- Invitación local de acceso. Es la puerta de entrada al sistema.
-- Vinculada opcionalmente a: lead de Coinvierte, usuario Better Auth, app_user.
-- El token se almacena como hash SHA-256; el token original solo se muestra
-- al crear la invitación (antes de enviar el correo).
CREATE TABLE access_invitations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference      text NOT NULL UNIQUE,
  email_normalized      text NOT NULL
    CHECK (email_normalized = lower(trim(both from email_normalized))),
  token_hash            text NOT NULL,
  coinvest_lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  better_auth_user_id   text,
  app_user_id           uuid REFERENCES app_users(id) ON DELETE SET NULL,
  intended_role         app_user_role NOT NULL DEFAULT 'investor',
  status                invitation_status NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at           timestamptz,
  revoked_at            timestamptz,
  revoked_by            uuid REFERENCES app_users(id),
  revocation_reason     text,
  resend_count          integer NOT NULL DEFAULT 0,
  last_sent_at          timestamptz,
  created_by            uuid REFERENCES app_users(id),
  CONSTRAINT access_invitations_single_active
    EXCLUDE (email_normalized WITH =) WHERE (status = 'pending')
);
CREATE INDEX access_invitations_status_idx ON access_invitations (status);
CREATE INDEX access_invitations_email_idx ON access_invitations (email_normalized);
CREATE INDEX access_invitations_token_hash_idx ON access_invitations (token_hash);
CREATE INDEX access_invitations_coinvest_lead_idx ON access_invitations (coinvest_lead_id);

-- ── Tabla: project_user_access ─────────────────────────────────────────────
-- Autorización por proyecto. Un usuario solo puede ver proyectos
-- para los que tiene una concesión activa.
CREATE TABLE project_user_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status          project_access_status NOT NULL DEFAULT 'active',
  granted_by      uuid REFERENCES app_users(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_by      uuid REFERENCES app_users(id),
  revoked_at      timestamptz,
  reason          text,
  UNIQUE (app_user_id, opportunity_id)
);
CREATE INDEX project_user_access_user_idx ON project_user_access (app_user_id);
CREATE INDEX project_user_access_opportunity_idx ON project_user_access (opportunity_id);
CREATE INDEX project_user_access_active_idx ON project_user_access (app_user_id, opportunity_id) WHERE status = 'active';

-- ── Tabla: auth_audit_events ───────────────────────────────────────────────
-- Auditoría append-only de eventos de autenticación y autorización.
-- No almacena contraseñas, tokens, cookies, códigos TOTP ni enlaces completos.
CREATE TABLE auth_audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid REFERENCES app_users(id),
  action          text NOT NULL,
  subject_id      uuid REFERENCES app_users(id),
  resource_type   text,
  resource_id     text,
  result          text NOT NULL DEFAULT 'success',
  request_id      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX auth_audit_events_action_idx ON auth_audit_events (action);
CREATE INDEX auth_audit_events_actor_idx ON auth_audit_events (actor_id);
CREATE INDEX auth_audit_events_subject_idx ON auth_audit_events (subject_id);
CREATE INDEX auth_audit_events_created_at_idx ON auth_audit_events (created_at DESC);

COMMIT;
