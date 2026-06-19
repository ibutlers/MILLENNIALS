import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { hashToken } from '../auth/sessions.js';
import { AuthRepository } from '../auth/repository.js';
import { getBetterAuthServer } from '../auth/better-auth-plugin.js';

const SESSION_COOKIE = 'realstate_sid';

type AdminAuthUser = { userId: string; roles: string[] };

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

async function getBetterAuthUserFromRequest(request: FastifyRequest, pool: Pool): Promise<AdminAuthUser | null> {
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
  if (appUser.status !== 'active' && !(appUser.status === 'pending_mfa' && !require2FA)) return null;
  if (!appUser.email_verified_at) return null;
  if (require2FA && (!appUser.mfa_enabled_at || !session.user.twoFactorEnabled)) return null;

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

export async function getUserFromRequest(
  request: FastifyRequest,
  pool: Pool,
): Promise<AdminAuthUser | null> {
  const betterAuthUser = await getBetterAuthUserFromRequest(request, pool);
  if (betterAuthUser) return betterAuthUser;
  return getLegacyUserFromRequest(request, pool);
}

export function requireRole(pool: Pool, ...roles: string[]) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await getUserFromRequest(request, pool);
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
