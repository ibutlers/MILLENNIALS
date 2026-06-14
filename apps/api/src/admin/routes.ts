/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { requireRole } from './auth.js';
import { buildPaginatedResponse } from './helpers.js';
import { z } from 'zod';

// ── Schemas ──

const opportunityPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  shortDescription: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
  city: z.string().max(100).optional(),
  countryCode: z.string().length(2).optional(),
  district: z.string().max(100).optional().nullable(),
  assetType: z.string().max(50).optional(),
  strategy: z.string().max(50).optional(),
  status: z.enum(['coming_soon','open','funding','funded','in_execution','commercializing','closed','cancelled']).optional(),
  visibility: z.enum(['public','private','unlisted','draft']).optional(),
  editorialStatus: z.enum(['draft','review','published','unlisted','private','archived']).optional(),
  currency: z.string().length(3).optional(),
  targetAmountCents: z.number().int().min(0).optional(),
  committedAmountCents: z.number().int().min(0).optional(),
  minimumInvestmentCents: z.number().int().min(0).optional(),
  estimatedTermMonths: z.number().int().min(1).max(360).optional(),
  targetReturnType: z.enum(['target_annual_return','target_total_return','target_irr','target_roi']).optional().nullable(),
  targetReturnBps: z.number().int().min(0).max(100000).optional().nullable(),
  riskLevel: z.enum(['low','medium','high','very_high']).optional(),
  closingDate: z.string().datetime().optional().nullable(),
  disclaimer: z.string().max(2000).optional().nullable(),
  version: z.number().int().min(1),
});

const leadPatchSchema = z.object({
  status: z.enum(['new','in_review','contacted','qualified','disqualified','converted']).optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
});

const leadNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

const userStatusSchema = z.object({
  status: z.enum(['active','suspended','disabled']),
});

const userRoleSchema = z.object({
  role: z.enum(['investor','operator','admin']),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['created_at','updated_at','title','status','editorial_status','risk_level','city']).default('created_at'),
  order: z.enum(['asc','desc']).default('desc'),
});

const VALID_SORT_COLS = new Set(['created_at','updated_at','title','status','editorial_status','risk_level','city']);

// ── Gate preHandler ──

function adminGate(config: AppConfig) {
  return async function gate(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!config.adminEnabled) {
      void reply.status(503).send({
        error: { id: 'err_admin_disabled', code: 'admin_disabled', message: 'El panel administrativo todav\u00eda no est\u00e1 habilitado.' }
      });
    }
  };
}

// ── Main ──

export function registerAdminRoutes(app: FastifyInstance, options: { pool: Pool; config: AppConfig }): void {
  const { pool, config } = options;

  // ═══ Dashboard ═══
  app.get('/api/v1/admin/dashboard', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (_req, _reply) => {
    const [rOppsTotal, rOppsPublished, rOppsDraft,
           rLeadsNew, rLeadsUnassigned, rUsersActive,
           rSessionsActive,
           recentAudit] = await Promise.all([
      pool.query<{ oppsTotal: number }>('SELECT count(*)::int AS "oppsTotal" FROM opportunities'),
      pool.query<{ oppsPublished: number }>('SELECT count(*)::int AS "oppsPublished" FROM opportunities WHERE editorial_status = $1', ['published']),
      pool.query<{ oppsDraft: number }>('SELECT count(*)::int AS "oppsDraft" FROM opportunities WHERE editorial_status IN ($1,$2)', ['draft', 'review']),
      pool.query<{ leadsNew: number }>('SELECT count(*)::int AS "leadsNew" FROM leads WHERE status = $1', ['new']),
      pool.query<{ leadsUnassigned: number }>('SELECT count(*)::int AS "leadsUnassigned" FROM leads WHERE assigned_user_id IS NULL'),
      pool.query<{ usersActive: number }>('SELECT count(*)::int AS "usersActive" FROM users WHERE status = $1', ['active']),
      pool.query<{ sessionsActive: number }>('SELECT count(*)::int AS "sessionsActive" FROM sessions WHERE revoked_at IS NULL AND expires_at > now()'),
      pool.query('SELECT event_type, entity_type, entity_reference, summary, created_at FROM audit_events ORDER BY created_at DESC LIMIT 10'),
    ]);
    const oppsTotal = rOppsTotal.rows[0]?.oppsTotal ?? 0;
    const oppsPublished = rOppsPublished.rows[0]?.oppsPublished ?? 0;
    const oppsDraft = rOppsDraft.rows[0]?.oppsDraft ?? 0;
    const leadsNew = rLeadsNew.rows[0]?.leadsNew ?? 0;
    const leadsUnassigned = rLeadsUnassigned.rows[0]?.leadsUnassigned ?? 0;
    const usersActive = rUsersActive.rows[0]?.usersActive ?? 0;
    const sessionsActive = rSessionsActive.rows[0]?.sessionsActive ?? 0;

    return {
      data: {
        opportunities: { total: oppsTotal, published: oppsPublished, drafts: oppsDraft },
        leads: { new: leadsNew, unassigned: leadsUnassigned },
        users: { active: usersActive },
        sessions: { active: sessionsActive },
        recentActivity: recentAudit.rows,
        warnings: [] as string[],
      }
    };
  });

  // ═══ Opportunities List ═══
  app.get('/api/v1/admin/opportunities', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const sortCol = VALID_SORT_COLS.has(q.sort) ? q.sort : 'created_at';
    const sortOrder = q.order === 'asc' ? 'ASC' : 'DESC';
    const conditions: string[] = ['1=1'];
    const vals: any[] = [];
    const f = req.query as Record<string, string>;
    if (f.editorialStatus) { vals.push(f.editorialStatus); conditions.push(`editorial_status=$${vals.length}`); }
    if (f.visibility) { vals.push(f.visibility); conditions.push(`visibility=$${vals.length}`); }
    if (f.status) { vals.push(f.status); conditions.push(`status=$${vals.length}`); }
    if (f.riskLevel) { vals.push(f.riskLevel); conditions.push(`risk_level=$${vals.length}`); }
    if (f.city) { vals.push(f.city); conditions.push(`city=$${vals.length}`); }
    if (f.search) { vals.push(`%${f.search}%`); conditions.push(`(title ILIKE $${vals.length} OR slug ILIKE $${vals.length})`); }
    const where = conditions.join(' AND ');
    const { rows } = await pool.query(
      `SELECT id, slug, title, editorial_status, visibility, status, risk_level, city, version, updated_at, created_at
       FROM opportunities WHERE ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query(`SELECT count(*)::int FROM opportunities WHERE ${where}`, vals);
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ═══ Opportunities Detail ═══
  app.get('/api/v1/admin/opportunities/:id', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM opportunities WHERE id = $1', [(req.params as any).id]);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
    return { data: rows[0] };
  });

  // ═══ Opportunities Create ═══
  app.post('/api/v1/admin/opportunities', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const b = req.body as Record<string, any> || {};
    const slug = b.slug || `opp-${Date.now().toString(36)}`;
    const title = b.title || 'Sin t\u00edtulo';
    const { rows: [opp] } = await pool.query(
      `INSERT INTO opportunities (slug, title, short_description, city, country_code, asset_type, strategy, editorial_status, visibility, status, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft','private','coming_soon',1) RETURNING *`,
      [slug, title, b.shortDescription || '', b.city || '', b.countryCode || 'ES', b.assetType || '', b.strategy || '']
    );
    return reply.status(201).send({ data: opp });
  });

  // ═══ Opportunities Update (PATCH) ═══
  app.patch('/api/v1/admin/opportunities/:id', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const patch = opportunityPatchSchema.parse(req.body);
    const { rows: [current] } = await pool.query('SELECT id, version FROM opportunities WHERE id = $1', [oppId]);
    if (!current) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
    if (patch.version !== current.version) {
      return reply.status(409).send({
        error: { code: 'version_conflict', message: 'La oportunidad fue modificada por otro usuario. Recarga la p\u00e1gina e int\u00e9ntalo de nuevo.', currentVersion: current.version, providedVersion: patch.version }
      });
    }
    const ALLOWED: string[] = [
      'title','slug','shortDescription','description','city','countryCode','district',
      'assetType','strategy','status','visibility','editorialStatus','currency',
      'targetAmountCents','committedAmountCents','minimumInvestmentCents',
      'estimatedTermMonths','targetReturnType','targetReturnBps','riskLevel',
      'closingDate','disclaimer'
    ];
    const fieldMap: Record<string, string> = {
      shortDescription: 'short_description', countryCode: 'country_code',
      assetType: 'asset_type', editorialStatus: 'editorial_status',
      targetAmountCents: 'target_amount_cents', committedAmountCents: 'committed_amount_cents',
      minimumInvestmentCents: 'minimum_investment_cents', estimatedTermMonths: 'estimated_term_months',
      targetReturnType: 'target_return_type', targetReturnBps: 'target_return_bps',
      riskLevel: 'risk_level', closingDate: 'closing_date',
    };
    const sets: string[] = []; const vals: any[] = []; const patchAny = patch as Record<string, any>;
    for (const key of ALLOWED) {
      if (patchAny[key] !== undefined && key !== 'version') {
        const col = fieldMap[key] || key;
        vals.push(patchAny[key]);
        sets.push(`${col}=$${vals.length}`);
      }
    }
    const newVersion = current.version + 1;
    if (sets.length > 0) {
      const { rows: [opp] } = await pool.query(
        `UPDATE opportunities SET ${sets.join(',')}, version=$1, updated_at=now() WHERE id=$2 RETURNING *`,
        [newVersion, oppId]
      );
      if (opp) {
        await pool.query('INSERT INTO opportunity_versions (opportunity_id, version, data) VALUES ($1,$2,$3)', [oppId, newVersion, JSON.stringify(opp)]).catch(() => {});
        await pool.query("INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", ['system', 'opportunity_updated', 'opportunity', opp.slug, `Updated, version ${newVersion}`]).catch(() => {});
      }
      return { data: opp };
    }
    return { data: current, _note: 'No changes detected' };
  });

  // ═══ Publish ═══
  app.post('/api/v1/admin/opportunities/:id/publish', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { rows } = await pool.query(
      `UPDATE opportunities SET editorial_status='published', visibility='public', status='open', published_at=COALESCE(published_at, now()), version=version+1, updated_at=now()
       WHERE id=$1 AND editorial_status NOT IN ('published','archived') RETURNING *`,
      [oppId]
    );
    if (!rows[0]) return reply.status(400).send({ error: { code: 'invalid_state', message: 'No se puede publicar esta oportunidad.' } });
    await pool.query("INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", ['system', 'opportunity_published', 'opportunity', rows[0].slug, 'Published']).catch(() => {});
    return { data: rows[0] };
  });

  // ═══ Unpublish ═══
  app.post('/api/v1/admin/opportunities/:id/unpublish', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { rows: [opp] } = await pool.query(
      "UPDATE opportunities SET editorial_status='draft', visibility='private', version=version+1, updated_at=now() WHERE id=$1 RETURNING *",
      [oppId]
    );
    if (!opp) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
    await pool.query("INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", ['system', 'opportunity_unpublished', 'opportunity', opp.slug, 'Unpublished']).catch(() => {});
    return { data: opp };
  });

  // ═══ Archive ═══
  app.post('/api/v1/admin/opportunities/:id/archive', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { rows: [opp] } = await pool.query(
      "UPDATE opportunities SET editorial_status='archived', visibility='private', version=version+1, updated_at=now() WHERE id=$1 RETURNING *",
      [oppId]
    );
    if (!opp) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
    await pool.query("INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", ['system', 'opportunity_archived', 'opportunity', opp.slug, 'Archived']).catch(() => {});
    return { data: opp };
  });

  // ═══ Leads List ═══
  app.get('/api/v1/admin/leads', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const conditions: string[] = ['1=1']; const vals: any[] = [];
    const f = req.query as Record<string, string>;
    if (f.status) { vals.push(f.status); conditions.push(`l.status=$${vals.length}`); }
    if (f.kind) { vals.push(f.kind); conditions.push(`l.kind=$${vals.length}`); }
    if (f.opportunityId) { vals.push(f.opportunityId); conditions.push(`l.opportunity_id=$${vals.length}`); }
    if (f.search) { vals.push(`%${f.search}%`); conditions.push(`l.public_reference ILIKE $${vals.length}`); }
    const where = conditions.join(' AND ');
    const { rows } = await pool.query(
      `SELECT l.id, l.public_reference, l.kind, l.status, l.opportunity_id, l.assigned_user_id, l.created_at
       FROM leads l WHERE ${where} ORDER BY l.created_at DESC LIMIT $${vals.length + 1} OFFSET $${vals.length + 2}`,
      [...vals, q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query(`SELECT count(*)::int FROM leads l WHERE ${where}`, vals);
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ═══ Lead Detail ═══
  app.get('/api/v1/admin/leads/:reference', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT l.*, COALESCE(json_agg(ln.* ORDER BY ln.created_at) FILTER (WHERE ln.id IS NOT NULL), $2) as notes FROM leads l LEFT JOIN lead_notes ln ON ln.lead_id = l.id WHERE l.public_reference = $1 GROUP BY l.id',
      [(req.params as any).reference, '[]']
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Lead no encontrado.' } });
    return { data: rows[0] };
  });

  // ═══ Lead Update ═══
  app.patch('/api/v1/admin/leads/:reference', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const body = leadPatchSchema.parse(req.body);
    const reference = (req.params as any).reference;
    const sets: string[] = []; const vals: any[] = [reference];
    if (body.status) { vals.push(body.status); sets.push(`status=$${vals.length}`); }
    if (body.assignedUserId !== undefined) { vals.push(body.assignedUserId); sets.push(`assigned_user_id=$${vals.length}`); }
    if (!sets.length) return reply.status(400).send({ error: { code: 'invalid_request', message: 'No se indicaron campos para actualizar.' } });
    const { rows } = await pool.query(`UPDATE leads SET ${sets.join(',')}, updated_at=now() WHERE public_reference=$1 RETURNING *`, vals);
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Lead no encontrado.' } });
    return { data: rows[0] };
  });

  // ═══ Lead Notes ═══
  app.post('/api/v1/admin/leads/:reference/notes', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const body = leadNoteSchema.parse(req.body);
    const { rows: [lead] } = await pool.query('SELECT id FROM leads WHERE public_reference=$1', [(req.params as any).reference]);
    if (!lead) return reply.status(404).send({ error: { code: 'not_found', message: 'Lead no encontrado.' } });
    await pool.query('INSERT INTO lead_notes (lead_id, author_id, content) VALUES ($1,$2,$3)', [lead.id, '00000000-0000-0000-0000-000000000000', body.content]);
    await pool.query("INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", ['system', 'lead_note_added', 'lead', (req.params as any).reference, 'Note added']).catch(() => {});
    return reply.status(201).send({ data: { created: true } });
  });

  // ═══ Users List ═══
  app.get('/api/v1/admin/users', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const { rows } = await pool.query(
      'SELECT u.id, u.public_reference, substring(u.email,1,2)||$1 as email, u.status, u.email_verified_at, u.created_at, COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), $2) as roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT $3 OFFSET $4',
      ['***', '[]', q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM users');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ═══ User Detail ═══
  app.get('/api/v1/admin/users/:reference', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT u.*, COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), $2) as roles, (SELECT count(*) FROM sessions WHERE user_id=u.id AND revoked_at IS NULL) as active_sessions FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.public_reference=$1 GROUP BY u.id',
      [(req.params as any).reference, '[]']
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    const { password_hash: _ph, ...safe } = rows[0];
    return { data: safe };
  });

  // ═══ User Status ═══
  app.patch('/api/v1/admin/users/:reference/status', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const body = userStatusSchema.parse(req.body);
    const { rows } = await pool.query(
      'UPDATE users SET status=$2 WHERE public_reference=$1 RETURNING id, email, status',
      [(req.params as any).reference, body.status]
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    return { data: rows[0] };
  });

  // ═══ User Roles ═══
  app.post('/api/v1/admin/users/:reference/roles', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const body = userRoleSchema.parse(req.body);
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING', [u.id, body.role]);
    return reply.status(201).send({ data: { created: true, role: body.role } });
  });

  app.delete('/api/v1/admin/users/:reference/roles/:role', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    await pool.query('DELETE FROM user_roles WHERE user_id=$1 AND role=$2', [u.id, (req.params as any).role]);
    return { data: { removed: true } };
  });

  // ═══ Revoke Sessions ═══
  app.delete('/api/v1/admin/users/:reference/sessions', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const { rows: [u] } = await pool.query('SELECT id FROM users WHERE public_reference=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    await pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [u.id]);
    return { data: { revoked: true } };
  });

  // ═══ Audit ═══
  app.get('/api/v1/admin/audit', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const { rows } = await pool.query(
      'SELECT id, actor_id, event_type, entity_type, entity_reference, summary, created_at FROM audit_events ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM audit_events');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ══════════════════════════════════════
  // Sub-entities — transactional update
  // ══════════════════════════════════════

  const subEntitiesSchema = z.object({
    highlights: z.array(z.object({
      _id: z.string().optional(),
      label: z.string().min(1).max(200),
      value: z.string().min(1).max(500),
      position: z.number().int().min(0),
    })).optional(),
    risks: z.array(z.object({
      _id: z.string().optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      position: z.number().int().min(0),
    })).optional(),
    milestones: z.array(z.object({
      _id: z.string().optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      plannedDate: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      position: z.number().int().min(0),
    })).optional(),
    media: z.array(z.object({
      _id: z.string().optional(),
      assetId: z.string().min(1).max(100),
      altText: z.string().max(500).optional().default(''),
      isPrimary: z.boolean().optional().default(false),
      position: z.number().int().min(0),
    })).optional(),
    version: z.number().int().min(1),
  });

  app.patch('/api/v1/admin/opportunities/:id/subentities', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const body = subEntitiesSchema.parse(req.body);

    // Version check
    const { rows: [current] } = await pool.query('SELECT id, version FROM opportunities WHERE id = $1', [oppId]);
    if (!current) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
    if (body.version !== current.version) {
      return reply.status(409).send({
        error: { code: 'version_conflict', message: 'La oportunidad fue modificada por otro usuario.', currentVersion: current.version, providedVersion: body.version }
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Highlights
      if (body.highlights !== undefined) {
        await client.query('DELETE FROM opportunity_highlights WHERE opportunity_id = $1', [oppId]);
        for (const h of body.highlights) {
          await client.query(
            'INSERT INTO opportunity_highlights (opportunity_id, label, value, position) VALUES ($1,$2,$3,$4)',
            [oppId, h.label, h.value, h.position]
          );
        }
      }

      // Risks
      if (body.risks !== undefined) {
        await client.query('DELETE FROM opportunity_risks WHERE opportunity_id = $1', [oppId]);
        for (const r of body.risks) {
          await client.query(
            'INSERT INTO opportunity_risks (opportunity_id, title, description, position) VALUES ($1,$2,$3,$4)',
            [oppId, r.title, r.description, r.position]
          );
        }
      }

      // Milestones
      if (body.milestones !== undefined) {
        await client.query('DELETE FROM opportunity_milestones WHERE opportunity_id = $1', [oppId]);
        for (const m of body.milestones) {
          await client.query(
            'INSERT INTO opportunity_milestones (opportunity_id, title, description, planned_date, completed_at, position) VALUES ($1,$2,$3,$4,$5,$6)',
            [oppId, m.title, m.description, m.plannedDate || null, m.completedAt || null, m.position]
          );
        }
      }

      // Media
      if (body.media !== undefined) {
        await client.query('DELETE FROM opportunity_media WHERE opportunity_id = $1', [oppId]);
        for (const md of body.media) {
          await client.query(
            'INSERT INTO opportunity_media (opportunity_id, type, url, alt_text, position) VALUES ($1,$2,$3,$4,$5)',
            [oppId, md.isPrimary ? 'primary' : 'secondary', `/assets/${md.assetId}`, md.altText || '', md.position]
          );
        }
      }

      // Bump version
      const newVersion = current.version + 1;
      const { rows: [opp] } = await client.query(
        'UPDATE opportunities SET version = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [newVersion, oppId]
      );

      // Snapshot
      await client.query(
        'INSERT INTO opportunity_versions (opportunity_id, version, data) VALUES ($1,$2,$3)',
        [oppId, newVersion, JSON.stringify(opp)]
      );

      // Audit
      await client.query(
        "INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)",
        ['system', 'opportunity_subentities_updated', 'opportunity', opp.slug, `Sub-entities updated, version ${newVersion}`]
      );

      await client.query('COMMIT');
      return { data: opp };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ══════════════════════════════════════
  // Preview
  // ══════════════════════════════════════
  app.get('/api/v1/admin/opportunities/:id/preview', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { rows: [opp] } = await pool.query('SELECT * FROM opportunities WHERE id = $1', [oppId]);
    if (!opp) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });

    // Fetch sub-entities
    const [{ rows: highlights }, { rows: risks }, { rows: milestones }, { rows: media }] = await Promise.all([
      pool.query('SELECT * FROM opportunity_highlights WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT * FROM opportunity_risks WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT * FROM opportunity_milestones WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT * FROM opportunity_media WHERE opportunity_id = $1 ORDER BY position', [oppId]),
    ]);

    return {
      data: { ...opp, highlights, risks, milestones, media },
      meta: { preview: true, message: 'Vista previa privada — no compartir públicamente' }
    };
  });

  // ══════════════════════════════════════
  // Version history
  // ══════════════════════════════════════
  const versionQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(20).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  });

  app.get('/api/v1/admin/opportunities/:id/versions', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const q = versionQuerySchema.parse(req.query);

    // Check opportunity exists
    const { rows: [opp] } = await pool.query('SELECT id FROM opportunities WHERE id = $1', [oppId]);
    if (!opp) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });

    const { rows } = await pool.query(
      'SELECT version, created_at, summary FROM audit_events WHERE entity_type = $1 AND entity_reference = (SELECT slug FROM opportunities WHERE id = $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4',
      ['opportunity', oppId, q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query(
      'SELECT count(*)::int FROM audit_events WHERE entity_type = $1 AND entity_reference = (SELECT slug FROM opportunities WHERE id = $2)',
      ['opportunity', oppId]
    );
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ══════════════════════════════════════
  // Workflow transition validation helper
  // ══════════════════════════════════════
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['review'],
    review: ['draft', 'published'],
    published: ['unlisted', 'private', 'archived'],
    unlisted: ['published', 'private', 'archived'],
    private: ['draft', 'review', 'archived'],
    archived: [], // no transitions from archived
  };

  function validateTransition(from: string, to: string, role: string): boolean {
    if (role === 'admin') {
      // Admin can do any defined transition
      return (VALID_TRANSITIONS[from] || []).includes(to);
    }
    // Operator can only: draft → review, review → draft
    if (role === 'operator') {
      const operatorAllowed: Record<string, string[]> = {
        draft: ['review'],
        review: ['draft'],
      };
      return (operatorAllowed[from] || []).includes(to);
    }
    return false;
  }

  // ── Workflow endpoint ──
  const transitionSchema = z.object({
    to: z.enum(['draft', 'review', 'published', 'unlisted', 'private', 'archived']),
  });

  app.post('/api/v1/admin/opportunities/:id/transition', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { to } = transitionSchema.parse(req.body);

    const { rows: [current] } = await pool.query('SELECT id, slug, editorial_status FROM opportunities WHERE id = $1', [oppId]);
    if (!current) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });

    // Get user role from auth context
    const user = (req as any)._authUser;
    const role = user?.roles?.includes('admin') ? 'admin' : 'operator';

    if (!validateTransition(current.editorial_status, to, role)) {
      return reply.status(409).send({
        error: { code: 'invalid_transition', message: `No se permite la transición de ${current.editorial_status} a ${to}.` }
      });
    }

    // If publishing, validate completeness
    if (to === 'published') {
      const { rows: [counts] } = await pool.query(
        `SELECT
          (SELECT count(*) FROM opportunity_risks WHERE opportunity_id = $1) as risk_count,
          (SELECT count(*) FROM opportunity_media WHERE opportunity_id = $1) as media_count
        `, [oppId]
      );
      const { rows: [opp] } = await pool.query('SELECT title, slug, description, city, target_return_type FROM opportunities WHERE id = $1', [oppId]);
      const errors: string[] = [];
      if (!opp.title) errors.push('Falta el título');
      if (!opp.slug) errors.push('Falta el slug');
      if (!opp.description) errors.push('Falta la descripción');
      if (!opp.city) errors.push('Falta la ciudad');
      if (!opp.target_return_type) errors.push('Falta el tipo de retorno');
      if (Number(counts?.risk_count || 0) === 0) errors.push('Se requiere al menos un riesgo');
      if (Number(counts?.media_count || 0) === 0) errors.push('Se requiere al menos una imagen');
      if (errors.length > 0) {
        return reply.status(422).send({ error: { code: 'validation_failed', message: 'Validación de publicación fallida', details: errors } });
      }
    }

    // Apply transition
    const visibilityMap: Record<string, string> = {
      published: 'public', unlisted: 'unlisted', private: 'private',
      draft: 'private', review: 'private', archived: 'private',
    };
    const newVersion = current.version + 1;
    const { rows: [updated] } = await pool.query(
      `UPDATE opportunities SET editorial_status = $1, visibility = $2, version = $3, updated_at = now(),
       published_at = CASE WHEN $1 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
       WHERE id = $4 RETURNING *`,
      [to, visibilityMap[to] || 'private', current.version + 1, oppId]
    );

    // Audit
    await pool.query(
      "INSERT INTO audit_events (actor_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)",
      ['system', `opportunity_${to}`, 'opportunity', current.slug, `Transitioned from ${current.editorial_status} to ${to}`]
    ).catch(() => {});

    // Snapshot
    await pool.query(
      'INSERT INTO opportunity_versions (opportunity_id, version, data) VALUES ($1,$2,$3)',
      [oppId, newVersion, JSON.stringify(updated)]
    ).catch(() => {});

    return { data: updated };
  });
}
