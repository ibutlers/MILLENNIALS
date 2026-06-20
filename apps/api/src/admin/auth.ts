import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { hashToken } from '../auth/sessions.js';
import { AuthRepository } from '../auth/repository.js';
import { getBetterAuthServer } from '../auth/better-auth-plugin.js';

const SESSION_COOKIE = 'realstate_sid';

type AdminAuthUser = { userId: string; roles: string[] };
type AdminAuthFailure = { status: number; code: string; message: string };
type AdminAuthResult = { user: AdminAuthUser; failure?: never } | { user?: never; failure: AdminAuthFailure } | { user?: undefined; failure?: undefined };

function adminAuthFailure(status: number, code: string, message: string): AdminAuthFailure {
  return { status, code, message };
}

function sendAdminAuthFailure(reply: FastifyReply, failure: AdminAuthFailure): void {
  void reply.status(failure.status).send({ error: { code: failure.code, message: failure.message } });
}

function isAdminAuthFailure(value: AdminAuthUser | AdminAuthFailure | null): value is AdminAuthFailure {
  return Boolean(value && 'code' in value && 'message' in value && 'status' in value);
}

function buildHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
}

async function getBetterAuthUserFromRequest(request: FastifyRequest, pool: Pool): Promise<AdminAuthUser | AdminAuthFailure | null> {
  const auth = getBetterAuthServer();
  if (!auth) return null;

  const session = await auth.api.getSession({ headers: buildHeaders(request) });
  if (!session?.user?.id) return null;

  const result = await pool.query<{
    id: string;
    role: string;
    status: string;
    email_verified_at: Date | null;
    mfa_enabled_at: Date | null;
  }>(
    `SELECT id, role, status, email_verified_at, mfa_enabled_at
     FROM app_users
     WHERE better_auth_user_id = $1`,
    [session.user.id],
  );

  const appUser = result.rows[0];
  if (!appUser) return null;

  const require2FA = process.env.BETTER_AUTH_REQUIRE_2FA !== 'false';
  if (appUser.status === 'suspended') return adminAuthFailure(403, 'account_suspended', 'La cuenta está suspendida.');
  if (appUser.status === 'revoked') return adminAuthFailure(403, 'account_revoked', 'La cuenta ha sido revocada.');
  if (!appUser.email_verified_at) return adminAuthFailure(403, 'email_not_verified', 'Debes verificar tu correo antes de continuar.');
  if (require2FA && (appUser.status === 'pending_mfa' || !appUser.mfa_enabled_at || !session.user.twoFactorEnabled)) {
    return adminAuthFailure(403, 'mfa_required', 'Debes completar la verificación en dos pasos (2FA).');
  }
  if (appUser.status !== 'active' && !(appUser.status === 'pending_mfa' && !require2FA)) return null;

  const roles = [appUser.role];
  if (appUser.role === 'staff') roles.push('operator');
  return { userId: appUser.id, roles };
}

async function getLegacyUserFromRequest(request: FastifyRequest, pool: Pool): Promise<AdminAuthUser | null> {
  const repo = new AuthRepository(pool);
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await repo.findSessionByTokenHash(tokenHash);
  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) return null;
  if (session.userStatus !== 'active') return null;

  const roles = await repo.getUserRoles(session.userId);
  return { userId: session.userId, roles };
}

async function getAuthResultFromRequest(
  request: FastifyRequest,
  pool: Pool,
): Promise<AdminAuthResult> {
  const betterAuthUser = await getBetterAuthUserFromRequest(request, pool);
  if (isAdminAuthFailure(betterAuthUser)) return { failure: betterAuthUser };
  if (betterAuthUser && 'roles' in betterAuthUser) return { user: betterAuthUser };
  const legacyUser = await getLegacyUserFromRequest(request, pool);
  return legacyUser ? { user: legacyUser } : {};
}

export async function getUserFromRequest(
  request: FastifyRequest,
  pool: Pool,
): Promise<AdminAuthUser | null> {
  const result = await getAuthResultFromRequest(request, pool);
  return result.user || null;
}

export function requireRole(pool: Pool, ...roles: string[]) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authResult = await getAuthResultFromRequest(request, pool);
    if (authResult.failure) {
      sendAdminAuthFailure(reply, authResult.failure);
      return;
    }
    const user = authResult.user;
    if (!user) {
      void reply.status(401).send({ error: { code: 'unauthorized', message: 'Autenticación requerida.' } });
      return;
    }
    const hasRole = roles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      void reply.status(403).send({ error: { code: 'forbidden', message: 'No tienes permisos para esta acción.' } });
      return;
    }
    (request as FastifyRequest & { _authUser?: AdminAuthUser })._authUser = user;
  };
}

export function requireAdmin(pool: Pool) { return requireRole(pool, 'admin'); }
export function requireOperator(pool: Pool) { return requireRole(pool, 'admin', 'operator', 'staff'); }
