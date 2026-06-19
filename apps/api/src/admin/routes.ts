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
  status: z.enum(['active','suspended','revoked']),
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
const VALID_MEDIA_TYPES = ['image','document','floorplan','video','other'] as const;
const highlightSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  position: z.number().int().min(0).optional(),
});
const riskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});
const milestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  planned_date: z.string().datetime({ offset: true }).nullable().optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  position: z.number().int().min(0).optional(),
});
const mediaSchema = z.object({
  type: z.enum(VALID_MEDIA_TYPES),
  url: z.string().min(1),
  alt_text: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});
const updateSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
});
function SECTION_OR_NULL_ARRAY(schema: z.ZodTypeAny) {
  return z.union([z.null(), z.undefined(), z.array(schema)]);
}

const snapshotSectionsSchema = z.object({
  highlights: SECTION_OR_NULL_ARRAY(highlightSchema),
  risks: SECTION_OR_NULL_ARRAY(riskSchema),
  milestones: SECTION_OR_NULL_ARRAY(milestoneSchema),
  media: SECTION_OR_NULL_ARRAY(mediaSchema),
  updates: SECTION_OR_NULL_ARRAY(updateSchema),
});


type Queryable = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

type OpportunitySnapshot = {
  opportunity: Record<string, any>;
  highlights: any[];
  risks: any[];
  milestones: any[];
  media: any[];
  updates: any[];
};

const OPPORTUNITY_INSERT_COLUMNS = [
  'slug', 'title', 'short_description', 'description', 'city', 'country_code', 'district',
  'asset_type', 'strategy', 'status', 'visibility', 'currency', 'target_amount_cents',
  'committed_amount_cents', 'minimum_investment_cents', 'estimated_term_months',
  'target_return_type', 'target_return_bps', 'risk_level', 'closing_date', 'published_at',
  'version', 'editorial_status', 'restored_from_opportunity_id', 'restored_from_version',
] as const;

async function buildOpportunitySnapshot(db: Queryable, opportunity: Record<string, any>): Promise<OpportunitySnapshot> {
  const opportunityId = opportunity.id;
  const { rows: highlights } = await db.query('SELECT label, value, position FROM opportunity_highlights WHERE opportunity_id = $1 ORDER BY position', [opportunityId]);
  const { rows: risks } = await db.query('SELECT title, description, position FROM opportunity_risks WHERE opportunity_id = $1 ORDER BY position', [opportunityId]);
  const { rows: milestones } = await db.query('SELECT title, description, planned_date, completed_at, position FROM opportunity_milestones WHERE opportunity_id = $1 ORDER BY position', [opportunityId]);
  const { rows: media } = await db.query('SELECT type, url, alt_text, position FROM opportunity_media WHERE opportunity_id = $1 ORDER BY position', [opportunityId]);
  const { rows: updates } = await db.query('SELECT title, body, published_at FROM opportunity_updates WHERE opportunity_id = $1 ORDER BY created_at', [opportunityId]);

  return {
    opportunity: { ...opportunity },
    highlights,
    risks,
    milestones,
    media,
    updates,
  };
}

function parseOpportunitySnapshot(raw: unknown): OpportunitySnapshot | null {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, any>;
  const opportunity = record.opportunity && typeof record.opportunity === 'object' ? record.opportunity : record;
  if (!opportunity || typeof opportunity !== 'object') return null;
  // Check each section separately to catch corrupt sections
  const highlightsRaw = 'highlights' in record ? record.highlights : undefined;
  const risksRaw = 'risks' in record ? record.risks : undefined;
  const milestonesRaw = 'milestones' in record ? record.milestones : undefined;
  const mediaRaw = 'media' in record ? record.media : undefined;
  const updatesRaw = 'updates' in record ? record.updates : undefined;

  // Reject non-array (present but corrupt) sections
  if (highlightsRaw !== undefined && !Array.isArray(highlightsRaw)) return null;
  if (risksRaw !== undefined && !Array.isArray(risksRaw)) return null;
  if (milestonesRaw !== undefined && !Array.isArray(milestonesRaw)) return null;
  if (mediaRaw !== undefined && !Array.isArray(mediaRaw)) return null;
  if (updatesRaw !== undefined && !Array.isArray(updatesRaw)) return null;

  const sections = snapshotSectionsSchema.safeParse({
    highlights: highlightsRaw,
    risks: risksRaw,
    milestones: milestonesRaw,
    media: mediaRaw,
    updates: updatesRaw,
  });
  if (!sections.success) return null;

  return {
    opportunity,
    highlights: sections.data.highlights ?? [],
    risks: sections.data.risks ?? [],
    milestones: sections.data.milestones ?? [],
    media: sections.data.media ?? [],
    updates: sections.data.updates ?? [],
  };
}

function slugifyForRestore(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'opportunity';
}

async function generateRestoreSlug(client: Queryable, sourceSlug: string, restoreVersion: number): Promise<string> {
  const base = `${slugifyForRestore(sourceSlug)}-restored-v${restoreVersion}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [base]);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const { rows } = await client.query('SELECT id FROM opportunities WHERE slug = $1 LIMIT 1', [candidate]);
    if (rows.length === 0) return candidate;
  }
  throw new Error('Unable to generate unique restore slug');
}

async function copySnapshotSubentities(client: Queryable, restoredOpportunityId: string, snapshot: OpportunitySnapshot): Promise<void> {
  for (const h of snapshot.highlights) {
    await client.query(
      'INSERT INTO opportunity_highlights (opportunity_id, label, value, position) VALUES ($1,$2,$3,$4)',
      [restoredOpportunityId, h.label, h.value, h.position ?? 0],
    );
  }
  for (const r of snapshot.risks) {
    await client.query(
      'INSERT INTO opportunity_risks (opportunity_id, title, description, position) VALUES ($1,$2,$3,$4)',
      [restoredOpportunityId, r.title, r.description ?? '', r.position ?? 0],
    );
  }
  for (const m of snapshot.milestones) {
    await client.query(
      'INSERT INTO opportunity_milestones (opportunity_id, title, description, planned_date, completed_at, position) VALUES ($1,$2,$3,$4,$5,$6)',
      [restoredOpportunityId, m.title, m.description ?? '', m.planned_date ?? null, m.completed_at ?? null, m.position ?? 0],
    );
  }
  for (const md of snapshot.media) {
    await client.query(
      'INSERT INTO opportunity_media (opportunity_id, type, url, alt_text, position) VALUES ($1,$2,$3,$4,$5)',
      [restoredOpportunityId, md.type ?? 'image', md.url, md.alt_text ?? null, md.position ?? 0],
    );
  }
  for (const u of snapshot.updates) {
    await client.query(
      'INSERT INTO opportunity_updates (opportunity_id, title, body, published_at) VALUES ($1,$2,$3,$4)',
      [restoredOpportunityId, u.title, u.body, u.published_at ?? null],
    );
  }
}

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
      `INSERT INTO opportunities (slug, title, short_description, description, city, country_code, asset_type, strategy, currency, target_amount_cents, minimum_investment_cents, estimated_term_months, target_return_type, risk_level, editorial_status, visibility, status, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft','private','coming_soon',1) RETURNING *`,
      [slug, title, b.shortDescription || '', b.description || '', b.city || '', b.countryCode || 'ES', b.assetType || '', b.strategy || '', b.currency || 'EUR', b.targetAmountCents || 0, b.minimumInvestmentCents || 0, b.estimatedTermMonths || 12, b.targetReturnType || 'target_irr', b.riskLevel || 'medium']
    );
    return reply.status(201).send({ data: opp });
  });

  // ═══ Opportunities Update (PATCH) ═══
  app.patch('/api/v1/admin/opportunities/:id', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const patch = opportunityPatchSchema.parse(req.body);
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
    if (sets.length === 0) {
      return reply.status(400).send({ error: { code: 'invalid_request', message: 'No se indicaron campos para actualizar.' } });
    }

    const newVersion = patch.version + 1;
    const versionParam = vals.length + 1;
    const idParam = vals.length + 2;
    const expectedVersionParam = vals.length + 3;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [opp] } = await client.query(
        `UPDATE opportunities SET ${sets.join(', ')}, version=$${versionParam}, updated_at=now()
         WHERE id=$${idParam} AND version=$${expectedVersionParam}
         RETURNING *`,
        [...vals, newVersion, oppId, patch.version]
      );
      if (!opp) {
        await client.query('ROLLBACK');
        const { rows: [current] } = await pool.query('SELECT id, version FROM opportunities WHERE id = $1', [oppId]);
        if (!current) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
        return reply.status(409).send({
          error: { code: 'version_conflict', message: 'La oportunidad fue modificada por otro usuario. Recarga la p\u00e1gina e int\u00e9ntalo de nuevo.', currentVersion: current.version, providedVersion: patch.version }
        });
      }
      await client.query('INSERT INTO opportunity_versions (opportunity_id, version, snapshot) VALUES ($1,$2,$3)', [oppId, newVersion, JSON.stringify(await buildOpportunitySnapshot(client, opp))]);
      await client.query("INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", [null, 'opportunity_updated', 'opportunity', opp.slug, `Updated, version ${newVersion}`]);
      await client.query('COMMIT');
      return { data: opp };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
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
    await pool.query("INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", [null, 'opportunity_published', 'opportunity', rows[0].slug, 'Published']).catch(() => {});
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
    await pool.query("INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", [null, 'opportunity_unpublished', 'opportunity', opp.slug, 'Unpublished']).catch(() => {});
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
    await pool.query("INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", [null, 'opportunity_archived', 'opportunity', opp.slug, 'Archived']).catch(() => {});
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
    await pool.query('INSERT INTO lead_notes (lead_id, author_id, body) VALUES ($1,$2,$3)', [lead.id, null, body.content]);
    await pool.query("INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)", [null, 'lead_note_added', 'lead', (req.params as any).reference, 'Note added']).catch(() => {});
    return reply.status(201).send({ data: { created: true } });
  });

  // ═══ Users List ═══
  app.get('/api/v1/admin/users', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const { rows } = await pool.query(
      `SELECT au.id,
              au.id::text AS public_reference,
              au.email_normalized AS email,
              au.status,
              au.email_verified_at,
              au.created_at,
              ARRAY[au.role::text] AS roles
       FROM app_users au
       ORDER BY au.created_at DESC
       LIMIT $1 OFFSET $2`,
      [q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query('SELECT count(*)::int FROM app_users');
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ═══ User Detail ═══
  app.get('/api/v1/admin/users/:reference', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT au.id,
              au.id::text AS public_reference,
              au.better_auth_user_id,
              au.email_normalized AS email,
              au.display_name,
              au.role,
              au.status,
              au.email_verified_at,
              au.mfa_enabled_at,
              au.activated_at,
              au.suspended_at,
              au.revoked_at,
              au.last_login_at,
              au.created_at,
              au.updated_at,
              ARRAY[au.role::text] AS roles,
              (SELECT count(*)::int FROM auth.session s WHERE s.user_id = au.better_auth_user_id AND s.expires_at > now()) AS active_sessions,
              ba.email_verified AS better_auth_email_verified,
              ba."twoFactorEnabled" AS better_auth_two_factor_enabled
       FROM app_users au
       LEFT JOIN auth."user" ba ON ba.id = au.better_auth_user_id
       WHERE au.id::text = $1`,
      [(req.params as any).reference]
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    return { data: rows[0] };
  });

  // ═══ User Status ═══
  app.patch('/api/v1/admin/users/:reference/status', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const body = userStatusSchema.parse(req.body);
    const ref = (req.params as any).reference;
    if (body.status !== 'active') {
      const { rows: [target] } = await pool.query('SELECT id, role, status FROM app_users WHERE id::text=$1', [ref]);
      if (!target) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
      if (target.role === 'admin' && target.status === 'active') {
        const { rows: [{ count }] } = await pool.query("SELECT count(*)::int FROM app_users WHERE role='admin' AND status='active' AND id <> $1", [target.id]);
        if (Number(count) === 0) {
          return reply.status(409).send({ error: { code: 'last_admin', message: 'No se puede desactivar el último admin activo.' } });
        }
      }
    }
    const { rows } = await pool.query(
      `UPDATE app_users
       SET status=$2::app_user_status,
           suspended_at = CASE WHEN $2 = 'suspended' THEN now() WHEN $2 = 'active' THEN NULL ELSE suspended_at END,
           revoked_at = CASE WHEN $2 = 'revoked' THEN now() WHEN $2 = 'active' THEN NULL ELSE revoked_at END,
           activated_at = CASE WHEN $2 = 'active' THEN COALESCE(activated_at, now()) ELSE activated_at END,
           updated_at=now()
       WHERE id::text=$1
       RETURNING id::text AS public_reference, email_normalized AS email, status, role`,
      [ref, body.status]
    );
    if (!rows[0]) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    return { data: rows[0] };
  });

  // ═══ User Roles ═══
  app.post('/api/v1/admin/users/:reference/roles', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const body = userRoleSchema.parse(req.body);
    const ref = (req.params as any).reference;
    const { rows: [target] } = await pool.query('SELECT id, role, status FROM app_users WHERE id::text=$1', [ref]);
    if (!target) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    if (body.role !== 'admin' && target.role === 'admin' && target.status === 'active') {
      const { rows: [{ count }] } = await pool.query("SELECT count(*)::int FROM app_users WHERE role='admin' AND status='active' AND id <> $1", [target.id]);
      if (Number(count) === 0) {
        return reply.status(409).send({ error: { code: 'last_admin', message: 'No se puede retirar el rol del último admin activo.' } });
      }
    }
    const { rows: [u] } = await pool.query(
      `UPDATE app_users SET role=$2::app_user_role, updated_at=now()
       WHERE id=$1
       RETURNING id::text AS public_reference, role`,
      [target.id, body.role]
    );
    return reply.status(201).send({ data: { created: true, role: u.role } });
  });

  app.delete('/api/v1/admin/users/:reference/roles/:role', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const ref = (req.params as any).reference;
    const role = (req.params as any).role;
    const { rows: [target] } = await pool.query('SELECT id, role, status FROM app_users WHERE id::text=$1', [ref]);
    if (!target) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    if (role === 'admin' && target.role === 'admin' && target.status === 'active') {
      const { rows: [{ count }] } = await pool.query("SELECT count(*)::int FROM app_users WHERE role='admin' AND status='active' AND id <> $1", [target.id]);
      if (Number(count) === 0) {
        return reply.status(409).send({ error: { code: 'last_admin', message: 'No se puede retirar el rol del último admin activo.' } });
      }
    }
    if (target.role === role) {
      await pool.query("UPDATE app_users SET role='investor', updated_at=now() WHERE id=$1", [target.id]);
    }
    return { data: { removed: true } };
  });

  // ═══ Revoke Sessions ═══
  app.delete('/api/v1/admin/users/:reference/sessions', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const { rows: [u] } = await pool.query('SELECT better_auth_user_id FROM app_users WHERE id::text=$1', [(req.params as any).reference]);
    if (!u) return reply.status(404).send({ error: { code: 'not_found', message: 'Usuario no encontrado.' } });
    await pool.query('DELETE FROM auth.session WHERE user_id=$1', [u.better_auth_user_id]);
    return { data: { revoked: true } };
  });

  // ═══ Audit ═══
  app.get('/api/v1/admin/audit', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT id::text,
                user_id::text,
                event_type,
                entity_type,
                entity_reference,
                summary,
                created_at
         FROM audit_events
         UNION ALL
         SELECT id::text,
                actor_id::text AS user_id,
                action AS event_type,
                resource_type AS entity_type,
                resource_id::text AS entity_reference,
                result AS summary,
                created_at
         FROM auth_audit_events
       ) events
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query(
      `SELECT (
         (SELECT count(*)::int FROM audit_events) +
         (SELECT count(*)::int FROM auth_audit_events)
       )::int AS count`
    );
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
    removedHighlightIds: z.array(z.string().uuid()).optional(),
    risks: z.array(z.object({
      _id: z.string().optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      position: z.number().int().min(0),
    })).optional(),
    removedRiskIds: z.array(z.string().uuid()).optional(),
    milestones: z.array(z.object({
      _id: z.string().optional(),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      plannedDate: z.string().nullable().optional(),
      completedAt: z.string().nullable().optional(),
      position: z.number().int().min(0),
    })).optional(),
    removedMilestoneIds: z.array(z.string().uuid()).optional(),
    media: z.array(z.object({
      _id: z.string().optional(),
      assetId: z.string().min(1).max(100),
      altText: z.string().max(500).optional().default(''),
      isPrimary: z.boolean().optional().default(false),
      position: z.number().int().min(0),
    })).optional(),
    removedMediaIds: z.array(z.string().uuid()).optional(),
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

      // Helper: upsert sub-entities by ID (preserving stable identities)
      // Pattern: UPDATE existing rows, INSERT new ones, DELETE explicitly removed
      async function upsertSubEntities(
        table: string,
        columns: string[],
        items: Array<Record<string, any>>,
        removedIds: string[],
        oppId: string,
      ) {
        // Validate all _id values belong to this opportunity
        const existingIds = new Set(
          (await client.query(`SELECT id FROM ${table} WHERE opportunity_id = $1`, [oppId])).rows.map((r: any) => r.id)
        );

        for (const item of items) {
          if (item._id && !existingIds.has(item._id)) {
            if (existingIds.size > 0) {
              throw Object.assign(new Error(`Sub-entity ${item._id} does not belong to this opportunity`), { statusCode: 403 });
            }
          }
        }

        // Delete explicitly removed items (only IDs that exist and are marked for removal)
        if (removedIds.length > 0) {
          const validRemoved = removedIds.filter((id) => existingIds.has(id));
          if (validRemoved.length > 0) {
            await client.query(
              `DELETE FROM ${table} WHERE opportunity_id = $1 AND id = ANY($2::uuid[])`,
              [oppId, validRemoved]
            );
          }
        }

        // Update existing, insert new
        for (const item of items) {
          const isExisting = item._id && existingIds.has(item._id);
          if (isExisting) {
            const setClauses = columns.map((col, i) => `${col} = $${i + 3}`);
            const values = columns.map((col) => item[col] ?? null);
            await client.query(
              `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $1 AND opportunity_id = $2`,
              [item._id, oppId, ...values]
            );
          } else {
            const placeholders = columns.map((_, i) => `$${i + 2}`);
            const values = columns.map((col) => item[col] ?? null);
            await client.query(
              `INSERT INTO ${table} (opportunity_id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`,
              [oppId, ...values]
            );
          }
        }
      }

      // Highlights
      if (body.highlights !== undefined) {
        await upsertSubEntities(
          'opportunity_highlights',
          ['label', 'value', 'position'],
          body.highlights,
          body.removedHighlightIds || [],
          oppId,
        );
      }

      // Risks
      if (body.risks !== undefined) {
        await upsertSubEntities(
          'opportunity_risks',
          ['title', 'description', 'position'],
          body.risks,
          body.removedRiskIds || [],
          oppId,
        );
      }

      // Milestones
      if (body.milestones !== undefined) {
        await upsertSubEntities(
          'opportunity_milestones',
          ['title', 'description', 'planned_date', 'completed_at', 'position'],
          body.milestones.map((m: any) => ({ ...m, planned_date: m.plannedDate || null, completed_at: m.completedAt || null })),
          body.removedMilestoneIds || [],
          oppId,
        );
      }

      // Media
      if (body.media !== undefined) {
        const mediaRows = body.media.map((md: any) => ({
          type: 'image',
          url: `/assets/${md.assetId}`,
          alt_text: md.altText || '',
          position: md.position,
          _id: md._id,
        }));
        await upsertSubEntities(
          'opportunity_media',
          ['type', 'url', 'alt_text', 'position'],
          mediaRows,
          body.removedMediaIds || [],
          oppId,
        );
      }

      // Bump version
      const newVersion = current.version + 1;
      const { rows: [opp] } = await client.query(
        'UPDATE opportunities SET version = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [newVersion, oppId]
      );

      // Snapshot
      await client.query(
        'INSERT INTO opportunity_versions (opportunity_id, version, snapshot) VALUES ($1,$2,$3)',
        [oppId, newVersion, JSON.stringify(await buildOpportunitySnapshot(client, opp))]
      );

      // Audit
      await client.query(
        "INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)",
        [null, 'opportunity_updated', 'opportunity', opp.slug, `Sub-entities updated, version ${newVersion}`]
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

  // GET sub-entities for an opportunity
  app.get('/api/v1/admin/opportunities/:id/subentities', {
    preHandler: [adminGate(config), requireRole(pool, 'admin', 'operator')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const { rows: [opp] } = await pool.query('SELECT id FROM opportunities WHERE id = $1', [oppId]);
    if (!opp) return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });

    const [{ rows: highlights }, { rows: risks }, { rows: milestones }, { rows: media }] = await Promise.all([
      pool.query('SELECT id, label, value, position FROM opportunity_highlights WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT id, title, description, position FROM opportunity_risks WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT id, title, description, planned_date, completed_at, position FROM opportunity_milestones WHERE opportunity_id = $1 ORDER BY position', [oppId]),
      pool.query('SELECT id, type, url, alt_text, position FROM opportunity_media WHERE opportunity_id = $1 ORDER BY position', [oppId]),
    ]);

    return { data: { highlights, risks, milestones, media } };
  });

  // ══════════════════════════════════════
  // Version restore
  // ══════════════════════════════════════
  app.post('/api/v1/admin/opportunities/:id/versions/:version/restore', {
    preHandler: [adminGate(config), requireRole(pool, 'admin')]
  }, async (req, reply) => {
    const oppId = (req.params as any).id;
    const restoreVersion = parseInt((req.params as any).version, 10);
    if (!Number.isInteger(restoreVersion) || restoreVersion < 1) {
      return reply.status(400).send({ error: { code: 'invalid_version', message: 'Versión inválida.' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [current] } = await client.query('SELECT * FROM opportunities WHERE id = $1 FOR UPDATE', [oppId]);
      if (!current) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: { code: 'not_found', message: 'Oportunidad no encontrada.' } });
      }

      const { rows: [snapshotRow] } = await client.query(
        'SELECT version, snapshot AS data FROM opportunity_versions WHERE opportunity_id = $1 AND version = $2 FOR SHARE',
        [oppId, restoreVersion],
      );
      if (!snapshotRow) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: { code: 'version_not_found', message: 'Versión no encontrada.' } });
      }

      let snapshot: OpportunitySnapshot | null = null;
      try {
        snapshot = parseOpportunitySnapshot(snapshotRow.data);
      } catch {
        snapshot = null;
      }
      if (!snapshot) {
        await client.query('ROLLBACK');
        return reply.status(422).send({ error: { code: 'invalid_snapshot', message: 'El snapshot histórico no es válido.' } });
      }

      const historicalData = snapshot.opportunity;
      const restoredSlug = await generateRestoreSlug(client, historicalData.slug || current.slug, restoreVersion);
      const values = [
        restoredSlug,
        historicalData.title || current.title,
        historicalData.short_description || current.short_description,
        historicalData.description ?? current.description,
        historicalData.city || current.city,
        historicalData.country_code || current.country_code,
        historicalData.district ?? null,
        historicalData.asset_type || current.asset_type,
        historicalData.strategy || current.strategy,
        'coming_soon',
        'private',
        historicalData.currency || current.currency,
        historicalData.target_amount_cents ?? current.target_amount_cents,
        0,
        historicalData.minimum_investment_cents ?? current.minimum_investment_cents,
        historicalData.estimated_term_months ?? current.estimated_term_months,
        historicalData.target_return_type || current.target_return_type,
        historicalData.target_return_bps ?? null,
        historicalData.risk_level || current.risk_level,
        historicalData.closing_date ?? null,
        null,
        1,
        'draft',
        current.id,
        restoreVersion,
      ];
      const placeholders = OPPORTUNITY_INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(',');
      const { rows: [restored] } = await client.query(
        `INSERT INTO opportunities (${OPPORTUNITY_INSERT_COLUMNS.join(',')}) VALUES (${placeholders}) RETURNING *`,
        values,
      );

      await copySnapshotSubentities(client, restored.id, snapshot);

      await client.query(
        'INSERT INTO opportunity_versions (opportunity_id, version, snapshot) VALUES ($1,$2,$3)',
        [restored.id, 1, JSON.stringify(await buildOpportunitySnapshot(client, restored))],
      );
      await client.query(
        "INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)",
        [null, 'opportunity_updated', 'opportunity', restored.slug, `Restored ${current.slug} version ${restoreVersion} as new draft`],
      );

      await client.query('COMMIT');
      return { data: restored, meta: { restoredFromOpportunityId: current.id, restoredFromVersion: restoreVersion } };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
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
      `SELECT ov.version, ov.created_at, ae.summary
       FROM opportunity_versions ov
       LEFT JOIN audit_events ae
         ON ae.entity_type = $1
        AND ae.entity_reference = (SELECT slug FROM opportunities WHERE id = $2)
        AND ae.summary ILIKE '%' || ov.version::text || '%'
       WHERE ov.opportunity_id = $2
       ORDER BY ov.version DESC
       LIMIT $3 OFFSET $4`,
      ['opportunity', oppId, q.limit, q.offset]
    );
    const { rows: [{ count }] } = await pool.query(
      'SELECT count(*)::int FROM opportunity_versions WHERE opportunity_id = $1',
      [oppId]
    );
    return buildPaginatedResponse(rows, Number(count), q.limit, q.offset);
  });

  // ══════════════════════════════════════
  // Workflow transition validation helper
  // ══════════════════════════════════════
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['review'],
    review: ['draft', 'published'],
    draft_admin: ['review', 'archived'],
    published: ['unlisted', 'private', 'archived'],
    unlisted: ['published', 'private', 'archived'],
    private: ['draft', 'review', 'archived'],
    archived: [], // no transitions from archived
  };

  function validateTransition(from: string, to: string, role: string): boolean {
    if (role === 'admin') {
      // Admin can do any defined transition; draft has one admin-only extension.
      const allowed = from === 'draft' ? VALID_TRANSITIONS.draft_admin : VALID_TRANSITIONS[from];
      return (allowed || []).includes(to);
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

    const { rows: [current] } = await pool.query('SELECT id, slug, editorial_status, version FROM opportunities WHERE id = $1', [oppId]);
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
      `UPDATE opportunities SET editorial_status = $1::editorial_status, visibility = $2::opportunity_visibility, version = $3, updated_at = now(),
       published_at = CASE WHEN $1::text = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
       WHERE id = $4 RETURNING *`,
      [to, visibilityMap[to] || 'private', current.version + 1, oppId]
    );

    // Audit
    await pool.query(
      "INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1,$2,$3,$4,$5)",
      [null, 'opportunity_status_changed', 'opportunity', current.slug, `Transitioned from ${current.editorial_status} to ${to}`]
    ).catch(() => {});

    // Snapshot
    await pool.query(
      'INSERT INTO opportunity_versions (opportunity_id, version, snapshot) VALUES ($1,$2,$3)',
      [oppId, newVersion, JSON.stringify(await buildOpportunitySnapshot(pool as any, updated))]
    ).catch(() => {});

    return { data: updated };
  });
}
