/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const SESSION = 'session-token';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const ORIGINAL_ID = '11111111-1111-1111-1111-111111111111';
const RESTORED_ID_1 = '22222222-2222-2222-2222-222222222222';
const RESTORED_ID_2 = '33333333-3333-3333-3333-333333333333';

function makeConfig() {
  return {
    authEnabled: true,
    registrationEnabled: false,
    emailDeliveryEnabled: false,
    e2eTestMode: false,
    e2eInternalSecret: undefined,
    appBaseUrl: 'https://localhost:8088',
    sessionCookieSecure: false,
    sessionTtlSeconds: 86400,
    sessionIdleTtlSeconds: 3600,
    emailVerificationTtlSeconds: 1800,
    passwordResetTtlSeconds: 1800,
    authRateLimitMax: 100,
    authRateLimitWindowMs: 900_000,
    adminEnabled: true,
    adminMediaUploadEnabled: false,
    demoSeedEnabled: false,
    leadsEnabled: false,
    privacyControllerName: '',
    privacyContactEmail: '',
    privacyPolicyVersion: '',
    leadsRateLimitMax: 5,
    leadsRateLimitWindowMs: 900_000,
  } as any;
}

type QueryRecord = { sql: string; params?: any[] };

function makeRestorePool(options: { failDuringSubentityCopy?: boolean; snapshotOverride?: any } = {}) {
  const calls: QueryRecord[] = [];
  const opportunities = new Map<string, any>();
  const slugs = new Set<string>();
  const audits: any[] = [];
  const versions: any[] = [];
  let currentRole: 'admin' | 'operator' = 'admin';
  let restoreCount = 0;
  let transactionCreatedIds: string[] = [];

  const original = {
    id: ORIGINAL_ID,
    slug: 'original-opportunity',
    title: 'Original title',
    short_description: 'Original short',
    description: 'Original description',
    city: 'Madrid',
    country_code: 'ES',
    district: 'Centro',
    asset_type: 'Residencial urbano',
    strategy: 'Reposicionamiento',
    status: 'open',
    visibility: 'unlisted',
    currency: 'EUR',
    target_amount_cents: 100_000_000,
    committed_amount_cents: 40_000_000,
    minimum_investment_cents: 5_000_000,
    estimated_term_months: 24,
    target_return_type: 'target_irr',
    target_return_bps: 1200,
    risk_level: 'medium',
    closing_date: null,
    published_at: '2026-06-01T00:00:00.000Z',
    version: 6,
    editorial_status: 'unlisted',
    restored_from_opportunity_id: null,
    restored_from_version: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
  };

  const snapshot = options.snapshotOverride ?? {
    opportunity: {
      ...original,
      slug: 'original-opportunity',
      title: 'Snapshot title',
      short_description: 'Snapshot short',
      description: 'Snapshot description',
      committed_amount_cents: 75_000_000,
      version: 3,
    },
    highlights: [{ label: 'Plazo', value: '24 meses', position: 0 }],
    risks: [{ title: 'Mercado', description: 'Puede variar.', position: 0 }],
    milestones: [{ title: 'Due diligence', description: 'Legal', planned_date: '2026-09-01T00:00:00.000Z', completed_at: null, position: 0 }],
    media: [{ type: 'image', url: '/assets/test.webp', alt_text: 'Imagen', position: 0 }],
    updates: [{ title: 'Nota editorial', body: 'Contenido', published_at: null }],
  };

  opportunities.set(ORIGINAL_ID, { ...original });
  slugs.add(original.slug);
  versions.push({ opportunity_id: ORIGINAL_ID, version: 3, snapshot });

  function sessionRows() {
    return [{
      id: '44444444-4444-4444-4444-444444444444',
      user_id: USER_ID,
      token_hash: 'hash',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      user_status: 'active',
    }];
  }

  async function handleQuery(sql: string, params?: any[]) {
    calls.push({ sql, params });
    if (sql === 'BEGIN') {
      transactionCreatedIds = [];
      return { rows: [], rowCount: 0 };
    }
    if (sql === 'COMMIT') {
      transactionCreatedIds = [];
      return { rows: [], rowCount: 0 };
    }
    if (sql === 'ROLLBACK') {
      for (const id of transactionCreatedIds) opportunities.delete(id);
      transactionCreatedIds = [];
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM sessions')) return { rows: sessionRows(), rowCount: 1 };
    if (sql.includes('SELECT role FROM user_roles')) return { rows: [{ role: currentRole }], rowCount: 1 };
    if (sql.includes('SELECT * FROM opportunities WHERE id = $1 FOR UPDATE')) {
      return { rows: opportunities.get(params?.[0]) ? [{ ...opportunities.get(params?.[0]) }] : [], rowCount: opportunities.has(params?.[0]) ? 1 : 0 };
    }
    if (sql.includes('SELECT version, snapshot AS data FROM opportunity_versions')) {
      const row = versions.find((v) => v.opportunity_id === params?.[0] && v.version === params?.[1]);
      return { rows: row ? [{ version: row.version, data: row.snapshot }] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT id FROM opportunities WHERE slug = $1')) {
      const slug = params?.[0];
      const found = [...opportunities.values()].find((o) => o.slug === slug);
      return { rows: found ? [{ id: found.id }] : [], rowCount: found ? 1 : 0 };
    }
    if (sql.includes('INSERT INTO opportunities')) {
      restoreCount += 1;
      const id = restoreCount === 1 ? RESTORED_ID_1 : RESTORED_ID_2;
      const [slug, title, short_description, description, city, country_code, district, asset_type, strategy, status, visibility, currency, target_amount_cents, committed_amount_cents, minimum_investment_cents, estimated_term_months, target_return_type, target_return_bps, risk_level, closing_date, published_at, version, editorial_status, restored_from_opportunity_id, restored_from_version] = params ?? [];
      const restored = { id, slug, title, short_description, description, city, country_code, district, asset_type, strategy, status, visibility, currency, target_amount_cents, committed_amount_cents, minimum_investment_cents, estimated_term_months, target_return_type, target_return_bps, risk_level, closing_date, published_at, version, editorial_status, restored_from_opportunity_id, restored_from_version, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      opportunities.set(id, restored);
      transactionCreatedIds.push(id);
      slugs.add(slug);
      return { rows: [restored], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO opportunity_highlights')) {
      if (options.failDuringSubentityCopy) throw new Error('subentity copy failed');
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO opportunity_risks')) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO opportunity_milestones')) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO opportunity_media')) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO opportunity_updates')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT label, value, position FROM opportunity_highlights')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT title, description, position FROM opportunity_risks')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT title, description, planned_date')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT type, url, alt_text, position FROM opportunity_media')) return { rows: [], rowCount: 1 };
    if (sql.includes('SELECT title, body, published_at FROM opportunity_updates')) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO opportunity_versions')) {
      versions.push({ opportunity_id: params?.[0], version: params?.[1], snapshot: params?.[2] });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO audit_events')) {
      audits.push({ params });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('SELECT id, slug, editorial_status, version FROM opportunities WHERE id = $1')) {
      const opp = opportunities.get(params?.[0]);
      return { rows: opp ? [{ id: opp.id, slug: opp.slug, editorial_status: opp.editorial_status, version: opp.version }] : [], rowCount: opp ? 1 : 0 };
    }
    if (sql.includes('UPDATE opportunities SET editorial_status = $1::editorial_status')) {
      const [to, visibility, version, id] = params ?? [];
      const opp = opportunities.get(id);
      const updated = { ...opp, editorial_status: to, visibility, version, updated_at: new Date().toISOString() };
      opportunities.set(id, updated);
      return { rows: [updated], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }

  const client = { query: vi.fn(handleQuery), release: vi.fn() };
  const pool = { connect: vi.fn(async () => client), query: vi.fn(handleQuery) } as any;
  return { pool, client, calls, opportunities, audits, versions, setRole: (role: 'admin' | 'operator') => { currentRole = role; } };
}

function buildTestApp(pool: any) {
  return buildApp({
    logger: false,
    pool,
    opportunities: {} as any,
    leads: { create: vi.fn() } as any,
    config: makeConfig(),
  });
}

describe('Admin API — restore lineage', () => {
  it('restores a version as a new private draft with lineage, unique slug, subentities and intact original', async () => {
    const ctx = makeRestorePool();
    const app = buildTestApp(ctx.pool);

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${ORIGINAL_ID}/versions/3/restore`,
      headers: { cookie: `realstate_sid=${SESSION}` },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body);
    const restored = firstBody.data;
    expect(restored.id).not.toBe(ORIGINAL_ID);
    expect(restored.slug).toBe('original-opportunity-restored-v3');
    expect(restored.editorial_status).toBe('draft');
    expect(restored.visibility).toBe('private');
    expect(restored.status).toBe('coming_soon');
    expect(restored.version).toBe(1);
    expect(restored.published_at).toBeNull();
    expect(restored.restored_from_opportunity_id).toBe(ORIGINAL_ID);
    expect(restored.restored_from_version).toBe(3);
    expect(restored.committed_amount_cents).toBe(0);
    expect(ctx.opportunities.get(ORIGINAL_ID).slug).toBe('original-opportunity');
    expect(ctx.opportunities.get(ORIGINAL_ID).editorial_status).toBe('unlisted');

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${ORIGINAL_ID}/versions/3/restore`,
      headers: { cookie: `realstate_sid=${SESSION}` },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).data.slug).toMatch(/^original-opportunity-restored-v3-/);
  });

  it('allows admin to archive restored drafts but keeps operator restrictions', async () => {
    const ctx = makeRestorePool();
    const app = buildTestApp(ctx.pool);
    const restore = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${ORIGINAL_ID}/versions/3/restore`,
      headers: { cookie: `realstate_sid=${SESSION}` },
    });
    const restored = JSON.parse(restore.body).data;

    ctx.setRole('operator');
    const blocked = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${restored.id}/transition`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: { to: 'archived' },
    });
    expect(blocked.statusCode).toBe(409);

    ctx.setRole('admin');
    const archived = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${restored.id}/transition`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: { to: 'archived' },
    });
    expect(archived.statusCode).toBe(200);
    const archivedBody = JSON.parse(archived.body).data;
    expect(archivedBody.editorial_status).toBe('archived');
    expect(archivedBody.visibility).toBe('private');
    expect(archivedBody.version).toBe(2);
    expect(ctx.opportunities.get(ORIGINAL_ID).editorial_status).toBe('unlisted');
    expect(ctx.audits.length).toBeGreaterThanOrEqual(2);
  });

  it('rolls back completely when subentity restoration fails', async () => {
    const ctx = makeRestorePool({ failDuringSubentityCopy: true });
    const app = buildTestApp(ctx.pool);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/opportunities/${ORIGINAL_ID}/versions/3/restore`,
      headers: { cookie: `realstate_sid=${SESSION}` },
    });

    expect(response.statusCode).toBe(500);
    expect(ctx.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(ctx.audits).toHaveLength(0);
    expect([...ctx.opportunities.keys()]).not.toContain(RESTORED_ID_1);
  });
});

describe('Admin API — snapshot validation', () => {
  const invalidCases: { label: string; snapshot: any; }[] = [
    { label: 'highlights: [null]', snapshot: { highlights: [null] } },
    { label: 'risks: ["invalid"]', snapshot: { risks: ['invalid'] } },
    { label: 'milestone sin title', snapshot: { milestones: [{ description: 'sin title' }] } },
    { label: 'media con type desconocido', snapshot: { media: [{ type: 'unknown', url: '/a.webp' }] } },
    { label: 'media sin url', snapshot: { media: [{ type: 'image' }] } },
    { label: 'update sin body', snapshot: { updates: [{ title: 'solo título' }] } },
    { label: 'position negativo', snapshot: { highlights: [{ label: 'Algo', value: 'x', position: -1 }] } },
    { label: 'position decimal', snapshot: { highlights: [{ label: 'Algo', value: 'x', position: 1.5 }] } },
    { label: 'fecha inválida', snapshot: { milestones: [{ title: 'Hito', planned_date: 'ayer' }] } },
    { label: 'sección como objeto', snapshot: { highlights: {} } },
    { label: 'update con title vacío', snapshot: { updates: [{ title: '', body: 'cuerpo' }] } },
    { label: 'media con url vacía', snapshot: { media: [{ type: 'image', url: '' }] } },
  ];

  for (const { label, snapshot } of invalidCases) {
    it(`rejects snapshot (${label}) with 422 invalid_snapshot, rollback and zero side effects`, async () => {
      const ctx = makeRestorePool({
        snapshotOverride: {
          opportunity: {
            id: ORIGINAL_ID, slug: 'original-opportunity', title: 'Title', short_description: 'Short',
            description: 'Desc', city: 'Madrid', country_code: 'ES', asset_type: 'Residencial urbano',
            strategy: 'Reposicionamiento', currency: 'EUR', target_amount_cents: 100_000_000,
            committed_amount_cents: 0, minimum_investment_cents: 5_000_000, estimated_term_months: 24,
            target_return_type: 'target_irr', target_return_bps: 1200, risk_level: 'medium',
            closing_date: null, status: 'open', visibility: 'unlisted', published_at: null, version: 3,
            editorial_status: 'unlisted',
          },
          ...snapshot,
        },
      });
      const app = buildTestApp(ctx.pool);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/opportunities/${ORIGINAL_ID}/versions/3/restore`,
        headers: { cookie: `realstate_sid=${SESSION}` },
      });

      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.body).error.code).toBe('invalid_snapshot');
      expect(ctx.client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(ctx.opportunities.get(RESTORED_ID_1)).toBeUndefined();
      expect(ctx.audits).toHaveLength(0);
    });
  }
});
