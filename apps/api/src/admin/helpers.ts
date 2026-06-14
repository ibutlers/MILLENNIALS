import type { FastifyReply } from 'fastify';

/** PreHandler that sends 503 if admin is disabled. */
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

/** Run a simple inline admin gate check — call inside route handler. Used when preHandler pattern doesn't work. */
export function checkAdminGate(config: { adminEnabled: boolean }, reply: FastifyReply): boolean {
  if (!config.adminEnabled) {
    void reply.status(503).send({
      error: { id: 'err_admin_disabled', code: 'admin_disabled', message: 'El panel administrativo todavía no está habilitado.' }
    });
    return false;
  }
  return true;
}
