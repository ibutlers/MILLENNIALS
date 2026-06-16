-- Migration 0008: Better Auth schema (v1.6.19 + plugins: two-factor, organization)
-- Schema: auth (separado del esquema public de negocio)
-- Generado a partir de getAuthTables() de Better Auth v1.6.19
-- Verificado: 2026-06-17
--
-- Tablas generadas:
--   user, session, account, verification, twoFactor, organization, member, invitation
--
-- Convenciones de nomenclatura de Better Auth (camelCase):
--   createdAt, updatedAt, expiresAt, emailVerified, twoFactorEnabled, etc.
--
-- NOTA: Better Auth añade implícitamente la columna 'id' (UUID/text PK) en cada tabla.
--        La aplicación usa el tipo TEXT para IDs (compatible con UUID v4 y otros formatos).

BEGIN;

-- ── Esquema auth ───────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

-- ── Tabla: user ────────────────────────────────────────────────────────────
-- Modelo central de Better Auth. Un usuario puede tener múltiples accounts
-- (email+password, OAuth, etc.) aunque en MVP solo usamos email+password.
CREATE TABLE auth.user (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL,
  email_verified  boolean NOT NULL DEFAULT false,
  image           text,
  two_factor_enabled boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_email_idx ON auth.user (email);

-- ── Tabla: session ─────────────────────────────────────────────────────────
-- Sesiones gestionadas por Better Auth. La cookie contiene un token
-- que referencia esta tabla. Better Auth maneja creación, validación
-- y revocación automáticamente.
CREATE TABLE auth.session (
  id                      text PRIMARY KEY,
  expires_at              timestamptz NOT NULL,
  token                   text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  ip_address              text,
  user_agent              text,
  user_id                 text NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
  active_organization_id  text
);
CREATE UNIQUE INDEX session_token_idx ON auth.session (token);
CREATE INDEX session_user_id_idx ON auth.session (user_id);

-- ── Tabla: account ─────────────────────────────────────────────────────────
-- Vincula un método de autenticación a un usuario. En MVP solo email+password.
-- providerId = 'email' para cuentas de email+password.
CREATE TABLE auth.account (
  id                        text PRIMARY KEY,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  user_id                   text NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_user_id_idx ON auth.account (user_id);
CREATE INDEX account_provider_account_idx ON auth.account (provider_id, account_id);

-- ── Tabla: verification ────────────────────────────────────────────────────
-- Tokens de verificación (email verification, password reset, etc.).
-- Better Auth usa esta tabla genérica para todos los tipos de verificación.
CREATE TABLE auth.verification (
  id          text PRIMARY KEY,
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_identifier_idx ON auth.verification (identifier);

-- ── Tabla: twoFactor ───────────────────────────────────────────────────────
-- Configuración TOTP por usuario. Backup codes se almacenan hasheados.
CREATE TABLE auth.two_factor (
  id            text PRIMARY KEY,
  secret        text NOT NULL,
  backup_codes  text NOT NULL,
  user_id       text NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
  verified      boolean DEFAULT true
);
CREATE UNIQUE INDEX two_factor_user_id_idx ON auth.two_factor (user_id);

-- ── Tabla: organization ────────────────────────────────────────────────────
-- Organización Better Auth. Solo existirá una: "MILLENNIALS CONSTRUYEN".
CREATE TABLE auth.organization (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL,
  logo        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  metadata    text
);
CREATE UNIQUE INDEX organization_slug_idx ON auth.organization (slug);

-- ── Tabla: member ──────────────────────────────────────────────────────────
-- Pertenencia de un usuario a una organización con un rol.
-- Roles: member, admin, owner
CREATE TABLE auth.member (
  id                text PRIMARY KEY,
  organization_id   text NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  user_id           text NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
  role              text NOT NULL DEFAULT 'member',
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX member_org_user_idx ON auth.member (organization_id, user_id);

-- ── Tabla: invitation ──────────────────────────────────────────────────────
-- Invitaciones de organización de Better Auth. Se usan como framework,
-- pero la invitación principal de negocio está en public.access_invitations.
CREATE TABLE auth.invitation (
  id                text PRIMARY KEY,
  organization_id   text NOT NULL REFERENCES auth.organization(id) ON DELETE CASCADE,
  email             text NOT NULL,
  role              text,
  status            text NOT NULL DEFAULT 'pending',
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  inviter_id        text NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE
);
CREATE INDEX invitation_org_idx ON auth.invitation (organization_id);
CREATE INDEX invitation_email_idx ON auth.invitation (email);

COMMIT;
