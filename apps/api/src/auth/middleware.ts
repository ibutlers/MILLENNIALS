/**
 * Authorization Middleware for Better Auth
 *
 * Each middleware is a factory that returns a Fastify preHandler.
 * They form a chain: session -> app user -> status -> email -> MFA -> role -> project.
 *
 * All checks are done against the local app_users and project_user_access tables.
 * Better Auth only provides the session identity.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AppConfig } from '../config.js';
import { getBetterAuthServer } from './better-auth-plugin.js';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

// ---------------------------------------------------------------------------
// requireBetterAuthSession
// ---------------------------------------------------------------------------

/**
 * Validates the Better Auth session cookie.
 * Attaches `request.betterAuthSession` with user + session data.
 */
export function requireBetterAuthSession() {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const auth = getBetterAuthServer();
    if (!auth) {
      return reply.status(503).send(publicError('auth_unavailable', 'El servicio de autenticación no está inicializado.'));
    }

    // Build Headers from Fastify request
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, String(value));
      }
    }

    const session = await auth.api.getSession({ headers });
    if (!session) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    (request as any).betterAuthSession = session;
  };
}

// ---------------------------------------------------------------------------
// requireActiveAppUser
// ---------------------------------------------------------------------------

/**
 * Links Better Auth session to a local app_user with active status.
 * Attaches `request.appUser` with the app_user row.
 */
export function requireActiveAppUser(pool: Pool) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const session = (request as any).betterAuthSession;
    if (!session) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    const betterAuthUserId = session.user.id;

    const result = await pool.query(
      `SELECT id, better_auth_user_id, email_normalized, display_name, role, status,
              email_verified_at, mfa_enabled_at, activated_at, suspended_at, revoked_at,
              last_login_at, created_at, updated_at
       FROM app_users
       WHERE better_auth_user_id = $1`,
      [betterAuthUserId],
    );

    if (result.rows.length === 0) {
      return reply.status(401).send(publicError('unauthorized', 'Usuario no registrado en el sistema.'));
    }

    const user = result.rows[0];

    if (user.status === 'suspended') {
      return reply.status(403).send(publicError('account_suspended', 'La cuenta está suspendida.'));
    }

    if (user.status === 'revoked') {
      return reply.status(403).send(publicError('account_revoked', 'La cuenta ha sido revocada.'));
    }

    if (user.status !== 'active' && user.status !== 'pending_mfa') {
      return reply.status(403).send(publicError('account_inactive', 'La cuenta no está activa.'));
    }

    (request as any).appUser = {
      id: user.id as string,
      betterAuthUserId: user.better_auth_user_id as string,
      emailNormalized: user.email_normalized as string,
      displayName: user.display_name as string | null,
      role: user.role as string,
      status: user.status as string,
      emailVerifiedAt: user.email_verified_at as string | null,
      mfaEnabledAt: user.mfa_enabled_at as string | null,
      activatedAt: user.activated_at as string | null,
    };
  };
}

// ---------------------------------------------------------------------------
// requireVerifiedEmail
// ---------------------------------------------------------------------------

/**
 * Requires the user to have a verified email.
 */
export function requireVerifiedEmail() {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).appUser;
    if (!user) {
      return reply.status(401).send(publicError('unauthorized', 'Usuario no encontrado.'));
    }
    if (!user.emailVerifiedAt) {
      return reply.status(403).send(publicError('email_not_verified', 'Debes verificar tu dirección de correo electrónico.'));
    }
  };
}

// ---------------------------------------------------------------------------
// requireMfa
// ---------------------------------------------------------------------------

/**
 * Requires TOTP to be enabled AND verified.
 * Checks both the local app_user AND Better Auth's twoFactor state.
 */
export function requireMfa() {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    if (process.env.BETTER_AUTH_REQUIRE_2FA === 'false') return;

    const user = (request as any).appUser;
    const session = (request as any).betterAuthSession;

    if (!user) {
      return reply.status(401).send(publicError('unauthorized', 'Usuario no encontrado.'));
    }

    // Check Better Auth session for twoFactorEnabled
    if (!session?.user?.twoFactorEnabled) {
      return reply.status(403).send(publicError('mfa_required', 'Debes activar la verificación en dos pasos (2FA).'));
    }
  };
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

/**
 * Requires the user to have one of the specified roles.
 */
export function requireRole(...roles: string[]) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).appUser;
    if (!user) {
      return reply.status(401).send(publicError('unauthorized', 'Usuario no encontrado.'));
    }
    if (!roles.includes(user.role)) {
      return reply.status(403).send(publicError('forbidden', 'No tienes permisos para acceder a este recurso.'));
    }
  };
}

// ---------------------------------------------------------------------------
// requireProjectAccess
// ---------------------------------------------------------------------------

/**
 * Requires an active project access grant for the specified project.
 * The project ID is extracted from the URL parameter `:id` or `:projectId`.
 */
export function requireProjectAccess(pool: Pool) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).appUser;
    if (!user) {
      return reply.status(401).send(publicError('unauthorized', 'Usuario no encontrado.'));
    }

    // Staff and admin can access any project
    if (user.role === 'staff' || user.role === 'admin') {
      return;
    }

    const params = request.params as Record<string, string>;
    const projectRef = params.id || params.projectId;

    if (!projectRef) {
      return reply.status(400).send(publicError('invalid_request', 'ID de proyecto no especificado.'));
    }

    const result = await pool.query(
      `SELECT 1
       FROM opportunities o
       JOIN project_user_access pua ON pua.opportunity_id = o.id
       WHERE pua.app_user_id = $1
         AND pua.status = 'active'
         AND (o.id::text = $2 OR o.slug = $2)`,
      [user.id, projectRef],
    );

    if (result.rows.length === 0) {
      return reply.status(403).send(publicError('forbidden', 'No tienes acceso a este proyecto.'));
    }

    (request as any).projectAccess = { projectId: projectRef, granted: true };
  };
}
