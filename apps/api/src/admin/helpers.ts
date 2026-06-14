import type { FastifyReply } from 'fastify';

/** Send 503 if admin is disabled. Works as Fastify preHandler. */
export function adminGate(config: { adminEnabled: boolean }) {
  return function gate(_request: unknown, reply: FastifyReply): void {
    if (!config.adminEnabled) {
      void reply.status(503).send({
        error: { id: 'err_admin_disabled', code: 'admin_disabled', message: 'El panel administrativo todavía no está habilitado.' }
      });
    }
  };
}

/** Build a paginated response envelope. */
export function buildPaginatedResponse(rows: unknown[], total: number, limit: number, offset: number) {
  return {
    data: rows,
    pagination: { limit, offset, total, hasMore: offset + rows.length < total },
  };
}
