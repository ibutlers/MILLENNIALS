/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { requireRole } from './auth.js';
import { buildPaginatedResponse, adminGate } from './helpers.js';

// ── Shared Zod fragments (reused across schemas) ────────────────────────────

const pag = { limit: z.coerce.number().int().min(1).default(20), offset: z.coerce.number().int().min(0).default(0) };
const nonEmpty = (n: number) => z.string().min(1).max(n);
const optStr = (n: number) => z.string().min(1).max(n).optional();
const optUrl = () => z.string().url().optional();
const optNum = () => z.number().int().min(0).optional();
const optDate = () => z.string().datetime().optional();
const optEnum = <T extends readonly [string, ...string[]]>(v: T) => z.enum(v).optional();
const slugPat = () => z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional();

const editorialEnum = z.enum(['draft', 'review', 'published', 'unlisted', 'private', 'archived']);
const visibilityEnum = z.enum(['public', 'private']);
const oppStatusEnum = z.enum(['draft', 'open', 'funded', 'closed', 'cancelled']);
const leadStatusEnum = z.enum(['new', 'contacted', 'qualified', 'converted', 'closed']);
const userStatusEnum = z.enum(['active', 'suspended', 'disabled']);

// ── Route-level schemas ─────────────────────────────────────────────────────

const oppListQ = z.object({ ...pag, limit: z.coerce.number().int().min(1).max(50).default(20),
  status: oppStatusEnum.optional(), visibility: visibilityEnum.optional(),
  editorialStatus: editorialEnum.optional(), search: z.string().max(255).optional() });

const createOppB = z.object({
  title: nonEmpty(255), slug: slugPat(), shortDescription: optStr(500), description: z.string().optional(),
  city: nonEmpty(128), countryCode: z.string().length(2).toUpperCase(),
  assetType: optStr(64), strategy: optStr(64), targetReturnType: optStr(32),
  riskLevel: optEnum(['low', 'medium', 'high'] as const), targetAmountCents: optNum(),
  minimumInvestmentCents: optNum(), currency: z.string().length(3).toUpperCase().default('EUR'),
  targetDate: optDate(), primaryImageUrl: optUrl(), sponsorName: optStr(255), sponsorLogoUrl: optUrl() });

const updateOppB = z.object({
  title: optStr(255), slug: slugPat(), shortDescription: optStr(500), description: z.string().optional(),
  city: optStr(128), countryCode: z.string().length(2).toUpperCase().optional(),
  assetType: optStr(64), strategy: optStr(64), targetReturnType: optStr(32),
  riskLevel: optEnum(['low', 'medium', 'high'] as const), targetAmountCents: optNum(),
  minimumInvestmentCents: optNum(), committedAmountCents: optNum(),
  currency: z.string().length(3).toUpperCase().optional(), targetDate: z.string().datetime().nullable().optional(),
  primaryImageUrl: z.string().url().nullable().optional(), sponsorName: z.string().max(255).nullable().optional(),
  sponsorLogoUrl: z.string().url().nullable().optional(),
  editorialStatus: editorialEnum.optional(), visibility: visibilityEnum.optional(), status: oppStatusEnum.optional(),
  version: z.number().int().min(1).optional() });

const leadsListQ = z.object({ ...pag, limit: z.coerce.number().int().min(1).max(50).default(20),
  status: leadStatusEnum.optional(), kind: optEnum(['contact', 'investment', 'partnership', 'other'] as const),
  opportunitySlug: z.string().optional(), assignedUserId: z.string().uuid().optional() });

const leadUpdB = z.object({ status: leadStatusEnum.optional(),
  assignedUserId: z.string().uuid().nullable().optional(), version: z.number().int().min(1) });

const leadNoteB = z.object({ content: z.string().min(1).max(5000) });
const userListQ = z.object(pag);
const userStatusB = z.object({ status: userStatusEnum });
const userRoleB = z.object({ role: nonEmpty(64) });

const auditListQ = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0), eventType: z.string().optional(),
  userId: z.string().uuid().optional(), entityId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(), dateTo: z.string().datetime().optional() });

// ── Helpers ──────────────────────────────────────────────────────────────────

type STR = Record<string, unknown>;

function diffFields(body: STR, existing: STR): string[] {
  return Object.keys(body).filter(k => k !== 'version' && body[k] !== existing[k]);
}

/** Build WHERE clause + values array from a simple filter map. Returns [clause, vals]. */
function buildWhere(filters: Record<string, unknown>, colMap?: Record<string, string>): [string, unknown[]] {
  const clauses: string[] = [], vals: unknown[] = [];
  let i = 1;
  for (const k of Object.keys(filters)) {
    const v = (filters as any)[k];
    if (v === undefined || v === null) continue;
    const col = colMap?.[k] ?? k;
    if (typeof v === 'string' && k === 'search') {
      clauses.push(`(${col} ILIKE $${i} OR slug ILIKE $${i})`); vals.push(`%${v}%`); i++;
    } else {
      clauses.push(`${col} = $${i++}`); vals.push(v);
    }
  }
  return [clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', vals];
}

/** Optimistic update helper: checks version, updates, records audit. */
async function optimisticUpdate(
  pool: Pool, table: string, id: string, clientVersion: number,
  updates: STR, userId: string, eventType: string, saveSnapshot = false,
): Promise<STR | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const set: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const k of Object.keys(updates)) { set.push(`${k} = $${i++}`); vals.push(updates[k]); }
    set.push(`version = $${i++}`); vals.push(clientVersion + 1); vals.push(id); vals.push(clientVersion);
    const w1 = i - 2, w2 = i - 1;
    const res = await client.query(
      `UPDATE ${table} SET ${set.join(', ')} WHERE id = $${w1} AND version = $${w2} RETURNING *`, vals);
    if (res.rows.length === 0) { await client.query('ROLLBACK'); return null; }
    const row = res.rows[0];
    if (saveSnapshot) {
      await client.query(
        `INSERT INTO opportunity_versions (opportunity_id, version, snapshot, changed_by) VALUES ($1,$2,$3,$4)`,
        [id, clientVersion + 1, JSON.stringify(row), userId]);
    }
    await client.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      [eventType, userId, table, id, JSON.stringify({ version: clientVersion + 1 })]);
    await client.query('COMMIT');
    return row;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

function uid(req: any): string { return req.userId; }
function fromParams<T>(req: any, keys: string[]): T {
  const out: any = {};
  for (const k of keys) out[k] = (req.params as any)[k];
  return out as T;
}
function notFound(reply: any, entity: string) {
  return reply.status(404).send({ error: 'NOT_FOUND', message: `${entity} not found` });
}
function conflict(reply: any, cv: number, pv: number) {
  return reply.status(409).send({ error: 'VERSION_CONFLICT', message: 'Modified by another user', currentVersion: cv, providedVersion: pv });
}

async function getOneOr404(pool: Pool, table: string, col: string, val: string, reply: any, cols = '*') {
  const r = await pool.query(`SELECT ${cols} FROM ${table} WHERE ${col} = $1`, [val]);
  if (r.rows.length === 0) { notFound(reply, table.slice(0, -1)); return null; }
  return r.rows[0];
}

// ── Route Registration ───────────────────────────────────────────────────────

export function registerAdminRoutes(app: FastifyInstance, options: { pool: Pool; config: AppConfig }): void {
  const { pool, config } = options;
  const gate = adminGate(config);
  const opGate = [gate, requireRole(pool, 'admin', 'operator')];
  const admGate = [gate, requireRole(pool, 'admin')];

  // ═══ OPPORTUNITIES ════════════════════════════════════════════════════════

  // 1. LIST
  app.get('/opportunities', { preHandler: opGate }, async (req, reply) => {
    const q = oppListQ.parse(req.query);
    const [wc, wv] = buildWhere({
      status: q.status, visibility: q.visibility, editorial_status: q.editorialStatus, search: q.search,
    });
    const ct = await pool.query(`SELECT COUNT(*) FROM opportunities ${wc}`, wv);
    const total = parseInt(ct.rows[0].count, 10);
    const data = await pool.query(
      `SELECT * FROM opportunities ${wc} ORDER BY created_at DESC LIMIT $${wv.length + 1} OFFSET $${wv.length + 2}`,
      [...wv, q.limit, q.offset]);
    return buildPaginatedResponse(data.rows, total, q.limit, q.offset);
  });

  // 2. CREATE
  app.post('/opportunities', { preHandler: opGate }, async (req, reply) => {
    const b = createOppB.parse(req.body);
    const slug = b.slug || b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fields: [string, unknown][] = [
      ['title', b.title], ['slug', slug], ['short_description', b.shortDescription ?? null],
      ['description', b.description ?? null], ['city', b.city], ['country_code', b.countryCode],
      ['asset_type', b.assetType ?? null], ['strategy', b.strategy ?? null],
      ['target_return_type', b.targetReturnType ?? null], ['risk_level', b.riskLevel ?? null],
      ['target_amount_cents', b.targetAmountCents ?? null], ['minimum_investment_cents', b.minimumInvestmentCents ?? null],
      ['currency', b.currency], ['target_date', b.targetDate ?? null], ['primary_image_url', b.primaryImageUrl ?? null],
      ['sponsor_name', b.sponsorName ?? null], ['sponsor_logo_url', b.sponsorLogoUrl ?? null],
      ['editorial_status', 'draft'], ['visibility', 'private'], ['status', 'draft'], ['version', 1],
    ];
    const cols = fields.map(f => f[0]); const vals = fields.map(f => f[1]);
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    const r = await pool.query(`INSERT INTO opportunities (${cols.join(', ')}) VALUES (${ph}) RETURNING *`, vals);
    await pool.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      ['opportunity_created', uid(req), 'opportunities', r.rows[0].id, JSON.stringify({ slug })]);
    return reply.status(201).send(r.rows[0]);
  });

  // 3. GET ONE
  app.get('/opportunities/:id', { preHandler: opGate }, async (req, reply) => {
    const row = await getOneOr404(pool, 'opportunities', 'id', (req.params as any).id, reply);
    if (!row) return;
    return row;
  });

  // 4. UPDATE (optimistic concurrency)
  app.patch('/opportunities/:id', { preHandler: opGate }, async (req, reply) => {
    const { id } = req.params as any;
    const b = updateOppB.parse(req.body);
    const cv = b.version ?? (req.headers['if-match'] ? parseInt(req.headers['if-match'] as string, 10) : null);
    if (!cv) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Version required' });

    const cur = await getOneOr404(pool, 'opportunities', 'id', id, reply);
    if (!cur) return;
    if (cur.version !== cv) return conflict(reply, cur.version, cv);

    const map: Record<string, string> = {
      title: 'title', slug: 'slug', shortDescription: 'short_description', description: 'description',
      city: 'city', countryCode: 'country_code', assetType: 'asset_type', strategy: 'strategy',
      targetReturnType: 'target_return_type', riskLevel: 'risk_level', targetAmountCents: 'target_amount_cents',
      minimumInvestmentCents: 'minimum_investment_cents', committedAmountCents: 'committed_amount_cents',
      currency: 'currency', targetDate: 'target_date', primaryImageUrl: 'primary_image_url',
      sponsorName: 'sponsor_name', sponsorLogoUrl: 'sponsor_logo_url',
      editorialStatus: 'editorial_status', visibility: 'visibility', status: 'status',
    };
    const updates: STR = {};
    for (const k of Object.keys(map)) { if ((b as any)[k] !== undefined) updates[map[k]] = (b as any)[k]; }
    if (Object.keys(updates).length === 0) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No fields to update' });

    const changed = diffFields(updates, cur);
    const updated = await optimisticUpdate(pool, 'opportunities', id, cur.version, updates, uid(req), 'opportunity_updated', true);
    if (!updated) return conflict(reply, cv + 1, cv);
    return { ...updated, _changedFields: changed };
  });

  // 5. PUBLISH
  app.post('/opportunities/:id/publish', { preHandler: admGate }, async (req, reply) => {
    const cur = await getOneOr404(pool, 'opportunities', 'id', (req.params as any).id, reply);
    if (!cur) return;
    const required = ['title', 'slug', 'short_description', 'description', 'city', 'country_code',
      'asset_type', 'strategy', 'target_return_type', 'risk_level', 'target_amount_cents', 'primary_image_url'];
    const missing = required.filter(c => !cur[c]);
    if (missing.length) return reply.status(400).send({ error: 'VALIDATION_FAILED', message: `Missing: ${missing.join(', ')}` });
    if (cur.target_amount_cents < 0) return reply.status(400).send({ error: 'VALIDATION_FAILED', message: 'Negative targetAmountCents' });
    if (cur.committed_amount_cents > cur.target_amount_cents) return reply.status(400).send({ error: 'VALIDATION_FAILED', message: 'committedAmount > targetAmount' });
    if (cur.target_date && new Date(cur.target_date) < new Date()) return reply.status(400).send({ error: 'VALIDATION_FAILED', message: 'targetDate in past' });

    const wasFirst = cur.editorial_status !== 'published';
    const up: STR = { editorial_status: 'published', visibility: 'public', status: cur.status === 'draft' ? 'open' : cur.status };
    if (wasFirst) up.published_at = new Date().toISOString();
    const u = await optimisticUpdate(pool, 'opportunities', cur.id, cur.version, up, uid(req), 'opportunity_published', true);
    if (!u) return conflict(reply, cur.version + 1, cur.version);
    return u;
  });

  // 6. UNPUBLISH
  app.post('/opportunities/:id/unpublish', { preHandler: admGate }, async (req, reply) => {
    const cur = await getOneOr404(pool, 'opportunities', 'id', (req.params as any).id, reply);
    if (!cur) return;
    const u = await optimisticUpdate(pool, 'opportunities', cur.id, cur.version,
      { editorial_status: 'draft', visibility: 'private', status: 'draft' }, uid(req), 'opportunity_unpublished', true);
    if (!u) return conflict(reply, cur.version + 1, cur.version);
    return u;
  });

  // 7. ARCHIVE
  app.post('/opportunities/:id/archive', { preHandler: admGate }, async (req, reply) => {
    const cur = await getOneOr404(pool, 'opportunities', 'id', (req.params as any).id, reply);
    if (!cur) return;
    const u = await optimisticUpdate(pool, 'opportunities', cur.id, cur.version,
      { editorial_status: 'archived', visibility: 'private' }, uid(req), 'opportunity_archived', true);
    if (!u) return conflict(reply, cur.version + 1, cur.version);
    return u;
  });

  // ═══ LEADS ════════════════════════════════════════════════════════════════

  // 8. LIST
  app.get('/leads', { preHandler: opGate }, async (req, reply) => {
    const q = leadsListQ.parse(req.query);
    const [wc, wv] = buildWhere({ status: q.status, kind: q.kind, opportunity_slug: q.opportunitySlug, assigned_user_id: q.assignedUserId });
    const ct = await pool.query(`SELECT COUNT(*) FROM leads ${wc}`, wv);
    const total = parseInt(ct.rows[0].count, 10);
    const data = await pool.query(
      `SELECT id, reference, kind, status, opportunity_slug, assigned_user_id, created_at, '***' AS email, name
       FROM leads ${wc} ORDER BY created_at DESC LIMIT $${wv.length + 1} OFFSET $${wv.length + 2}`,
      [...wv, q.limit, q.offset]);
    return buildPaginatedResponse(data.rows, total, q.limit, q.offset);
  });

  // 9. DETAIL
  app.get('/leads/:reference', { preHandler: opGate }, async (req, reply) => {
    const row = await getOneOr404(pool, 'leads', 'reference', (req.params as any).reference, reply);
    if (!row) return;
    const notes = await pool.query(
      `SELECT ln.id, ln.content, ln.created_at, u.email AS author_email
       FROM lead_notes ln JOIN users u ON u.id = ln.author_id
       WHERE ln.lead_id = $1 ORDER BY ln.created_at DESC`, [row.id]);
    return { ...row, notes: notes.rows };
  });

  // 10. UPDATE
  app.patch('/leads/:reference', { preHandler: opGate }, async (req, reply) => {
    const b = leadUpdB.parse(req.body);
    const cur = await getOneOr404(pool, 'leads', 'reference', (req.params as any).reference, reply);
    if (!cur) return;
    if (cur.version !== b.version) return conflict(reply, cur.version, b.version);
    const up: STR = {};
    if (b.status !== undefined) up.status = b.status;
    if (b.assignedUserId !== undefined) up.assigned_user_id = b.assignedUserId;
    if (!Object.keys(up).length) return reply.status(400).send({ error: 'BAD_REQUEST', message: 'No fields to update' });
    const u = await optimisticUpdate(pool, 'leads', cur.id, cur.version, up, uid(req),
      b.assignedUserId !== undefined ? 'lead_assigned' : 'lead_updated');
    if (!u) return conflict(reply, cur.version + 1, b.version);
    return u;
  });

  // 11. ADD NOTE
  app.post('/leads/:reference/notes', { preHandler: opGate }, async (req, reply) => {
    const { content } = leadNoteB.parse(req.body);
    const lead = await pool.query('SELECT id FROM leads WHERE reference = $1', [(req.params as any).reference]);
    if (lead.rows.length === 0) return notFound(reply, 'Lead');
    const note = await pool.query(
      'INSERT INTO lead_notes (lead_id, author_id, content) VALUES ($1,$2,$3) RETURNING *',
      [lead.rows[0].id, uid(req), content]);
    await pool.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      ['lead_note_added', uid(req), 'leads', lead.rows[0].id, JSON.stringify({ noteId: note.rows[0].id })]);
    return reply.status(201).send(note.rows[0]);
  });

  // ═══ USERS ════════════════════════════════════════════════════════════════

  // 12. LIST
  app.get('/users', { preHandler: admGate }, async (req, reply) => {
    const q = userListQ.parse(req.query);
    const ct = await pool.query('SELECT COUNT(*) FROM users');
    const total = parseInt(ct.rows[0].count, 10);
    const r = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.status, u.created_at,
              array_remove(array_agg(DISTINCT ur.role), NULL) AS roles
       FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`, [q.limit, q.offset]);
    const data = r.rows.map((row: any) => ({
      ...row, email: row.email ? row.email.replace(/(.{2}).*(@.*)/, '$1***$2') : null }));
    return buildPaginatedResponse(data, total, q.limit, q.offset);
  });

  // 13. DETAIL
  app.get('/users/:reference', { preHandler: admGate }, async (req, reply) => {
    const row = await getOneOr404(pool, 'users', 'id', (req.params as any).reference, reply,
      `u.*, array_remove(array_agg(DISTINCT ur.role), NULL) AS roles
       FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = $1 GROUP BY u.id`);
    if (!row) return;
    const sc = await pool.query('SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND expires_at > now()', [(req.params as any).reference]);
    return { ...row, activeSessions: parseInt(sc.rows[0].count, 10) };
  });

  // 14. CHANGE STATUS
  app.patch('/users/:reference/status', { preHandler: admGate }, async (req, reply) => {
    const { reference } = req.params as any;
    const { status } = userStatusB.parse(req.body);
    const cur = await getOneOr404(pool, 'users', 'id', reference, reply);
    if (!cur) return;
    if ((status === 'suspended' || status === 'disabled') && cur.status === 'active') {
      const ac = await pool.query(
        `SELECT COUNT(DISTINCT u.id) FROM users u JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role = 'admin' AND u.status = 'active' AND u.id != $1`, [reference]);
      const ia = await pool.query(`SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'`, [reference]);
      if (ia.rows.length > 0 && parseInt(ac.rows[0].count, 10) === 0)
        return reply.status(400).send({ error: 'LAST_ADMIN', message: 'Cannot disable the last active admin' });
    }
    const et = status === 'suspended' ? 'user_suspended' : status === 'active' ? 'user_reactivated' : 'user_status_changed';
    const u = await optimisticUpdate(pool, 'users', reference, cur.version, { status }, uid(req), et);
    if (!u) return conflict(reply, cur.version + 1, cur.version);
    return u;
  });

  // 15. ADD ROLE
  app.post('/users/:reference/roles', { preHandler: admGate }, async (req, reply) => {
    const { reference } = req.params as any;
    const { role } = userRoleB.parse(req.body);
    const cur = await getOneOr404(pool, 'users', 'id', reference, reply);
    if (!cur) return;
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2) ON CONFLICT (user_id, role) DO NOTHING', [reference, role]);
    await pool.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      ['role_added', uid(req), 'users', reference, JSON.stringify({ role })]);
    return reply.status(201).send({ userId: reference, role });
  });

  // 16. REMOVE ROLE
  app.delete('/users/:reference/roles/:role', { preHandler: admGate }, async (req, reply) => {
    const { reference, role } = req.params as any;
    const cur = await getOneOr404(pool, 'users', 'id', reference, reply);
    if (!cur) return;
    if (role === 'admin') {
      const ac = await pool.query(
        `SELECT COUNT(DISTINCT u.id) FROM users u JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role = 'admin' AND u.status = 'active'`);
      if (parseInt(ac.rows[0].count, 10) <= 1)
        return reply.status(400).send({ error: 'LAST_ADMIN_ROLE', message: 'Cannot remove the last admin role' });
    }
    const r = await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role = $2 RETURNING *', [reference, role]);
    if (r.rows.length === 0) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Role not found for user' });
    await pool.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      ['role_removed', uid(req), 'users', reference, JSON.stringify({ role })]);
    return { userId: reference, role, removed: true };
  });

  // 17. REVOKE SESSIONS
  app.delete('/users/:reference/sessions', { preHandler: admGate }, async (req, reply) => {
    const { reference } = req.params as any;
    const cur = await getOneOr404(pool, 'users', 'id', reference, reply);
    if (!cur) return;
    const r = await pool.query('DELETE FROM sessions WHERE user_id = $1 RETURNING id', [reference]);
    await pool.query(
      `INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
      ['session_admin_revoked', uid(req), 'users', reference, JSON.stringify({ revokedCount: r.rows.length })]);
    return { userId: reference, revokedSessions: r.rows.length };
  });

  // ═══ AUDIT ════════════════════════════════════════════════════════════════

  // 18. LIST AUDIT EVENTS
  app.get('/audit', { preHandler: admGate }, async (req, reply) => {
    const q = auditListQ.parse(req.query);
    const [wc, wv] = buildWhere({ event_type: q.eventType, user_id: q.userId, entity_id: q.entityId });
    // date range handled separately
    const extra: string[] = [];
    if (q.dateFrom) { extra.push(`created_at >= $${wv.length + extra.length + 1}`); wv.push(q.dateFrom); }
    if (q.dateTo) { extra.push(`created_at <= $${wv.length + extra.length + 1}`); wv.push(q.dateTo); }
    const fullWC = [wc.replace(/^WHERE /, ''), ...extra].filter(Boolean).join(' AND ');
    const finalWC = fullWC ? `WHERE ${fullWC}` : '';
    const ct = await pool.query(`SELECT COUNT(*) FROM audit_events ${finalWC}`, wv);
    const total = parseInt(ct.rows[0].count, 10);
    const data = await pool.query(
      `SELECT id, event_type, user_id, entity_type, entity_id, created_at
       FROM audit_events ${finalWC} ORDER BY created_at DESC
       LIMIT $${wv.length + 1} OFFSET $${wv.length + 2}`,
      [...wv, q.limit, q.offset]);
    return buildPaginatedResponse(data.rows, total, q.limit, q.offset);
  });
}
