import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { hashToken } from '../auth/sessions.js';
import { AuthRepository } from '../auth/repository.js';

const SESSION_COOKIE = 'realstate_sid';

export async function getUserFromRequest(
  request: FastifyRequest,
  pool: Pool,
): Promise<{ userId: string; roles: string[] } | null> {
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

export function requireRole(pool: Pool, ...roles: string[]) {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await getUserFromRequest(request, pool);
    if (!user) {
      void reply.status(401).send({ error: { code: 'unauthorized', message: 'Autenticación requerida.' } });
      return;
    }
    const hasRole = roles.some((r) => user.roles.includes(r));
    if (!hasRole) {
      void reply.status(403).send({ error: { code: 'forbidden', message: 'No tienes permisos para esta acción.' } });
      return;
    }
    (request as FastifyRequest & { _authUser?: { userId: string; roles: string[] } })._authUser = user;
  };
}

export function requireAdmin(pool: Pool) { return requireRole(pool, 'admin'); }
export function requireOperator(pool: Pool) { return requireRole(pool, 'admin', 'operator'); }
