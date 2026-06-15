/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const SESSION = 'session-token';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const OPP_ID = '11111111-1111-1111-1111-111111111111';

function makeConfig() {
  return {
    authEnabled: true,
    registrationEnabled: false,
    emailDeliveryEnabled: false,
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

function makePatchPool(options: { updateReturnsRow: boolean } = { updateReturnsRow: true }) {
  const calls: QueryRecord[] = [];
  const opportunity = {
    id: OPP_ID,
    slug: 'test-opportunity',
    title: 'Original title',
    short_description: 'Original short',
    description: 'Original description',
    city: 'Barcelona',
    country_code: 'ES',
    district: 'Eixample',
    asset_type: 'Residencial urbano',
    strategy: 'Rehabilitación energética',
    status: 'coming_soon',
    visibility: 'draft',
    currency: 'EUR',
    target_amount_cents: 100_000_000,
    committed_amount_cents: 0,
    minimum_investment_cents: 5_000_000,
    estimated_term_months: 24,
    target_return_type: 'target_irr',
    target_return_bps: 1200,
    risk_level: 'medium',
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const client = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('UPDATE opportunities SET')) {
        if (!options.updateReturnsRow) return { rows: [], rowCount: 0 };
        return {
          rows: [{
            ...opportunity,
            title: 'Updated title',
            district: null,
            target_amount_cents: 120_000_000,
            visibility: 'unlisted',
            version: 2,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO opportunity_versions')) return { rows: [], rowCount: 1 };
      if (sql.includes('SELECT label, value, position FROM opportunity_highlights')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT title, description, position FROM opportunity_risks')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT title, description, planned_date, completed_at, position FROM opportunity_milestones')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT type, url, alt_text, position FROM opportunity_media')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT title, body, published_at FROM opportunity_updates')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected transaction SQL: ${sql}`);
    }),
    release: vi.fn(),
  };

  const pool = {
    connect: vi.fn(async () => client),
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM sessions')) {
        return {
          rows: [{
            id: '22222222-2222-2222-2222-222222222222',
            user_id: USER_ID,
            token_hash: 'hash',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            revoked_at: null,
            user_status: 'active',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('SELECT role FROM user_roles')) return { rows: [{ role: 'admin' }], rowCount: 1 };
      if (sql.includes('SELECT id, version FROM opportunities')) {
        return { rows: [{ id: OPP_ID, version: 1 }], rowCount: 1 };
      }
      throw new Error(`Unexpected pool SQL: ${sql}`);
    }),
  } as any;

  return { pool, client, calls };
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

describe('Admin API — atomic opportunity PATCH', () => {
  it('persists mixed field types, increments version, snapshots and audits in one transaction', async () => {
    const { pool, client, calls } = makePatchPool({ updateReturnsRow: true });
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 1,
        title: 'Updated title',
        district: null,
        targetAmountCents: 120_000_000,
        visibility: 'unlisted',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.version).toBe(2);
    expect(body.data.title).toBe('Updated title');
    expect(body.data.district).toBeNull();
    expect(body.data.target_amount_cents).toBe(120_000_000);
    expect(body.data.visibility).toBe('unlisted');

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    const update = calls.find((call) => call.sql.includes('UPDATE opportunities SET'));
    expect(update).toBeDefined();
    expect(update?.sql).toContain('title=$1');
    expect(update?.sql).toContain('district=$2');
    expect(update?.sql).toContain('visibility=$3');
    expect(update?.sql).toContain('target_amount_cents=$4');
    expect(update?.sql).toContain('version=$5');
    expect(update?.sql).toContain('WHERE id=$6');
    expect(update?.sql).toContain('AND version=$7');
    expect(update?.params).toEqual(['Updated title', null, 'unlisted', 120_000_000, 2, OPP_ID, 1]);
    expect(calls.some((call) => call.sql.includes('INSERT INTO opportunity_versions'))).toBe(true);
    expect(calls.some((call) => call.sql.includes('INSERT INTO audit_events'))).toBe(true);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('returns 409 for stale version without snapshot, audit or partial update', async () => {
    const { pool, client, calls } = makePatchPool({ updateReturnsRow: false });
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: { version: 1, title: 'Stale update' },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('version_conflict');
    expect(calls.filter((call) => call.sql.includes('UPDATE opportunities SET'))).toHaveLength(1);
    expect(calls.some((call) => call.sql.includes('INSERT INTO opportunity_versions'))).toBe(false);
    expect(calls.some((call) => call.sql.includes('INSERT INTO audit_events'))).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('rejects PATCH requests that contain only version and no mutable fields', async () => {
    const { pool, client, calls } = makePatchPool({ updateReturnsRow: true });
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: { version: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('invalid_request');
    expect(calls.some((call) => call.sql.includes('UPDATE opportunities SET'))).toBe(false);
    expect(client.query).not.toHaveBeenCalled();
  });
});
