/* eslint-disable */
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { requireRole } from './auth.js';
import { buildPaginatedResponse } from './helpers.js';

export function registerAdminRoutes(app: FastifyInstance, options: { pool: Pool; config: AppConfig }): void {
  const { pool, config } = options;

  // Admin gate: return 503 if disabled
  function gate(reply: any): boolean {
    if (!config.adminEnabled) {
      void reply.status(503).send({
        error: { id: 'err_admin_disabled', code: 'admin_disabled', message: 'El panel administrativo todavía no está habilitado.' }
      });
      return false;
    }
    return true;
  }

  // Opportunities list
  app.get('/api/v1/admin/opportunities', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const q = { limit: Math.min(Number(req.query.limit) || 20, 50), offset: Number(req.query.offset) || 0 };
    const { rows } = await pool.query('SELECT * FROM opportunities ORDER BY created_at DESC LIMIT $1 OFFSET $2', [q.limit, q.offset]);
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM opportunities');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // Opportunities detail
  app.get('/api/v1/admin/opportunities/:id', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows } = await pool.query('SELECT * FROM opportunities WHERE id = $1', [(req.params as any).id]);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'No encontrada.' } });
    return { data: rows[0] };
  });

  // Create opportunity
  app.post('/api/v1/admin/opportunities', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const b = req.body || {};
    const { rows: [opp] } = await pool.query(
      `INSERT INTO opportunities (slug, title, short_description, city, country_code, asset_type, strategy, editorial_status, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft','private') RETURNING *`,
      [b.slug || `opp-${Date.now()}`, b.title || 'Sin título', b.shortDescription || '', b.city || '', b.countryCode || 'ES', b.assetType || '', b.strategy || '']
    );
    return reply.status(201).send({ data: opp });
  });

  // Publish
  app.post('/api/v1/admin/opportunities/:id/publish', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows } = await pool.query(
      'UPDATE opportunities SET editorial_status=$2, visibility=$3, status=$4, published_at=COALESCE(published_at, now()) WHERE id=$1 AND editorial_status NOT IN ($5,$6) RETURNING *',
      [(req.params as any).id, 'published', 'public', 'open', 'published', 'archived']
    );
    if (!rows[0]) return reply.status(400).send({ error: { code: 'invalid_state', message: 'No se puede publicar esta oportunidad.' } });
    return { data: rows[0] };
  });

  // Unpublish
  app.post('/api/v1/admin/opportunities/:id/unpublish', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [opp] } = await pool.query(
      "UPDATE opportunities SET editorial_status='draft', visibility='private' WHERE id=$1 RETURNING *",
      [(req.params as any).id]
    );
    if (!opp) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: opp };
  });

  // Archive
  app.post('/api/v1/admin/opportunities/:id/archive', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [opp] } = await pool.query(
      "UPDATE opportunities SET editorial_status='archived', visibility='private' WHERE id=$1 RETURNING *",
      [(req.params as any).id]
    );
    if (!opp) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: opp };
  });

  // Leads list
  app.get('/api/v1/admin/leads', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const q = { limit: Math.min(Number(req.query.limit) || 20, 50), offset: Number(req.query.offset) || 0 };
    const { rows } = await pool.query('SELECT id, public_reference, kind, status, created_at FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2', [q.limit, q.offset]);
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM leads');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // Lead detail
  app.get('/api/v1/admin/leads/:reference', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows } = await pool.query(
      'SELECT l.* FROM leads l WHERE l.public_reference = $1',
      [(req.params as any).reference]
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: rows[0] };
  });

  // Lead status update
  app.patch('/api/v1/admin/leads/:reference', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const b = req.body || {};
    const sets: string[] = []; const vals: any[] = [];
    if (b.status) { sets.push(`status=$${vals.length + 2}`); vals.push(b.status); }
    if (b.assignedUserId) { sets.push(`assigned_user_id=$${vals.length + 2}`); vals.push(b.assignedUserId); }
    if (!sets.length) return reply.status(400).send({ error: { code: 'invalid_request' } });
    const { rows } = await pool.query(`UPDATE leads SET ${sets.join(',')} WHERE public_reference=$1 RETURNING *`, [(req.params as any).reference, ...vals]);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: rows[0] };
  });

  // Lead notes
  app.post('/api/v1/admin/leads/:reference/notes', { preHandler: [requireRole(pool, 'admin', 'operator')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [lead] } = await pool.query('SELECT id FROM leads WHERE public_reference=$1', [(req.params as any).reference]);
    if (!lead) return reply.status(404).send({ error: { code: 'not_found' } });
    const b = req.body || {};
    await pool.query('INSERT INTO lead_notes (lead_id, author_id, content) VALUES ($1,$2,$3)', [lead.id, '00000000-0000-0000-0000-000000000000', b.content || '']);
    return reply.status(201).send({ data: { created: true } });
  });

  // Users list
  app.get('/api/v1/admin/users', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const q = { limit: Math.min(Number(req.query.limit) || 20, 50), offset: Number(req.query.offset) || 0 };
    const { rows } = await pool.query('SELECT id, public_reference, substring(email,1,2)||$1 as email, status, email_verified_at, created_at FROM users ORDER BY created_at DESC LIMIT $2 OFFSET $3', ['***', q.limit, q.offset]);
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM users');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // User detail
  app.get('/api/v1/admin/users/:reference', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows } = await pool.query(
      'SELECT u.*, COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), $2) as roles, (SELECT count(*) FROM sessions WHERE user_id=u.id AND revoked_at IS NULL) as active_sessions FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.public_reference=$1 GROUP BY u.id',
      [(req.params as any).reference, '[]']
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: rows[0] };
  });

  // User status
  app.patch('/api/v1/admin/users/:reference/status', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const b = req.body || {};
    const { rows } = await pool.query('UPDATE users SET status=$2 WHERE public_reference=$1 RETURNING *', [(req.params as any).reference, b.status || 'active']);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found' } });
    return { data: rows[0] };
  });

  // User roles
  app.post('/api/v1/admin/users/:reference/roles', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found' } });
    const b = req.body || {};
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u.id, b.role]);
    return reply.status(201).send({ data: { created: true } });
  });

  app.delete('/api/v1/admin/users/:reference/roles/:role', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found' } });
    await pool.query('DELETE FROM user_roles WHERE user_id=$1 AND role=$2', [u.id, (req.params as any).role]);
    return { data: { removed: true } };
  });

  // Revoke sessions
  app.delete('/api/v1/admin/users/:reference/sessions', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found' } });
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [u.id]);
    return { data: { revoked: true } };
  });

  // Audit
  app.get('/api/v1/admin/audit', { preHandler: [requireRole(pool, 'admin')] }, async (req: any, reply: any) => {
    if (!gate(reply)) return;
    const q = { limit: Math.min(Number(req.query.limit) || 20, 100), offset: Number(req.query.offset) || 0 };
    const { rows } = await pool.query('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1 OFFSET $2', [q.limit, q.offset]);
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM audit_events');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });
}
