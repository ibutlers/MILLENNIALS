/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const SESSION = 'session-token';
const USER_ID = '00000000-0000-0000-0000-000000000001';
const OPP_ID = '11111111-1111-1111-1111-111111111111';
const HIGHLIGHT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const HIGHLIGHT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HIGHLIGHT_OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

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

type PoolOptions = {
  version?: number;
  highlightIds?: string[];
  opportunityExists?: boolean;
};

function makeSubentitiesPool(options: PoolOptions = {}) {
  const calls: QueryRecord[] = [];
  const opportunityExists = options.opportunityExists ?? true;
  const opportunity = {
    id: OPP_ID,
    slug: 'test-opportunity',
    title: 'Test opportunity',
    version: options.version ?? 5,
  };
  const highlightIds = options.highlightIds ?? [HIGHLIGHT_A, HIGHLIGHT_B];

  const client = {
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT * FROM opportunities WHERE id = $1 FOR UPDATE')) {
        return { rows: opportunityExists ? [{ ...opportunity }] : [], rowCount: opportunityExists ? 1 : 0 };
      }
      if (sql.includes('SELECT id FROM opportunity_highlights')) {
        return { rows: highlightIds.map((id) => ({ id })), rowCount: highlightIds.length };
      }
      if (sql.includes('DELETE FROM opportunity_highlights')) return { rows: [], rowCount: Array.isArray(params?.[1]) ? params?.[1].length : 0 };
      if (sql.includes('UPDATE opportunity_highlights')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO opportunity_highlights')) return { rows: [], rowCount: 1 };
      if (sql.includes('UPDATE opportunities SET version')) return { rows: [{ ...opportunity, version: opportunity.version + 1 }], rowCount: 1 };
      if (sql.includes('SELECT label, value, position FROM opportunity_highlights')) {
        return { rows: [{ label: 'Nuevo dato', value: 'Nuevo valor', position: 0 }], rowCount: 1 };
      }
      if (sql.includes('SELECT title, description, position FROM opportunity_risks')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT title, description, planned_date, completed_at, position FROM opportunity_milestones')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT type, url, alt_text, position FROM opportunity_media')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT title, body, published_at FROM opportunity_updates')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO opportunity_versions')) return { rows: [], rowCount: 1 };
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
      if (sql.includes('SELECT id, version FROM opportunities')) return { rows: opportunityExists ? [{ id: OPP_ID, version: opportunity.version }] : [], rowCount: opportunityExists ? 1 : 0 };
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

describe('Admin API — opportunity subentities', () => {
  it('treats provided highlights as the full desired set so saving without ids cannot duplicate existing rows', async () => {
    const { pool, client, calls } = makeSubentitiesPool();
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}/subentities`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 5,
        highlights: [
          { label: 'Nuevo dato', value: 'Nuevo valor', position: 0 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.version).toBe(6);
    const deleteHighlights = calls.filter((call) => call.sql.includes('DELETE FROM opportunity_highlights'));
    expect(deleteHighlights).toHaveLength(1);
    expect(deleteHighlights[0].params).toEqual([OPP_ID, [HIGHLIGHT_A, HIGHLIGHT_B]]);
    expect(calls.filter((call) => call.sql.includes('INSERT INTO opportunity_highlights'))).toHaveLength(1);
    expect(calls.filter((call) => call.sql.includes('UPDATE opportunity_highlights'))).toHaveLength(0);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('checks the expected version under a row lock inside the transaction', async () => {
    const { pool, calls } = makeSubentitiesPool();
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}/subentities`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 5,
        highlights: [{ _id: HIGHLIGHT_A, label: 'Dato', value: 'Valor', position: 0 }],
      },
    });

    expect(response.statusCode).toBe(200);
    const preTransactionVersionReads = calls.filter((call) => call.sql.includes('SELECT id, version FROM opportunities'));
    expect(preTransactionVersionReads).toHaveLength(0);
    const beginIndex = calls.findIndex((call) => call.sql === 'BEGIN');
    const lockIndex = calls.findIndex((call) => call.sql.includes('SELECT * FROM opportunities WHERE id = $1 FOR UPDATE'));
    const updateIndex = calls.findIndex((call) => call.sql.includes('UPDATE opportunity_highlights'));
    expect(beginIndex).toBeGreaterThanOrEqual(0);
    expect(lockIndex).toBeGreaterThan(beginIndex);
    expect(updateIndex).toBeGreaterThan(lockIndex);
  });

  it('accepts id from GET as an alias for _id and updates the existing row', async () => {
    const { pool, calls } = makeSubentitiesPool();
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}/subentities`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 5,
        highlights: [
          { id: HIGHLIGHT_A, label: 'Dato conservado', value: 'Valor conservado', position: 0 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const deleteHighlights = calls.filter((call) => call.sql.includes('DELETE FROM opportunity_highlights'));
    expect(deleteHighlights).toHaveLength(1);
    expect(deleteHighlights[0].params).toEqual([OPP_ID, [HIGHLIGHT_B]]);
    expect(calls.filter((call) => call.sql.includes('UPDATE opportunity_highlights'))).toHaveLength(1);
    expect(calls.filter((call) => call.sql.includes('INSERT INTO opportunity_highlights'))).toHaveLength(0);
  });

  it('does not reinsert rows that are present in items and explicit removed ids', async () => {
    const { pool, calls } = makeSubentitiesPool();
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}/subentities`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 5,
        highlights: [
          { _id: HIGHLIGHT_A, label: 'Debe eliminarse', value: 'No reinserta', position: 0 },
        ],
        removedHighlightIds: [HIGHLIGHT_A],
      },
    });

    expect(response.statusCode).toBe(200);
    const deleteHighlights = calls.filter((call) => call.sql.includes('DELETE FROM opportunity_highlights'));
    expect(deleteHighlights).toHaveLength(1);
    expect(deleteHighlights[0].params).toEqual([OPP_ID, [HIGHLIGHT_A, HIGHLIGHT_B]]);
    expect(calls.filter((call) => call.sql.includes('UPDATE opportunity_highlights'))).toHaveLength(0);
    expect(calls.filter((call) => call.sql.includes('INSERT INTO opportunity_highlights'))).toHaveLength(0);
  });

  it('returns 403 for a subentity id that belongs outside the opportunity', async () => {
    const { pool } = makeSubentitiesPool({ highlightIds: [HIGHLIGHT_A] });
    const app = buildTestApp(pool);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/opportunities/${OPP_ID}/subentities`,
      headers: { cookie: `realstate_sid=${SESSION}` },
      payload: {
        version: 5,
        highlights: [
          { _id: HIGHLIGHT_OTHER, label: 'Ajeno', value: 'No permitido', position: 0 },
        ],
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
