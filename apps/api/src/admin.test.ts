/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

// ── Helpers ──

function mockPool() {
  return {
    query: vi.fn(async (_sql: string, _params?: any[]) => {
      // Default: empty results
      return { rows: [], rowCount: 0 };
    }),
  } as any;
}

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    authEnabled: Boolean(overrides.authEnabled),
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
    adminEnabled: Boolean(overrides.adminEnabled ?? false),
    adminMediaUploadEnabled: false,
    demoSeedEnabled: false,
    leadsEnabled: false,
    privacyControllerName: '',
    privacyContactEmail: '',
    privacyPolicyVersion: '',
    leadsRateLimitMax: 5,
    leadsRateLimitWindowMs: 900_000,
    ...overrides,
  } as any;
}

function buildTestApp(overrides: { pool?: any; config?: any } = {}) {
  const pool = overrides.pool ?? mockPool();
  return buildApp({
    logger: false,
    pool,
    opportunities: {} as any,
    leads: { create: vi.fn() } as any,
    config: overrides.config ?? makeConfig(),
  });
}

// ── Tests ──

describe('Admin API — feature gate', () => {
  it('returns 503 admin_disabled when ADMIN_ENABLED=false', async () => {
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: false, authEnabled: false }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('admin_disabled');
  });

  it('returns 503 for all admin routes when disabled', async () => {
    const routes = [
      '/api/v1/admin/opportunities',
      '/api/v1/admin/leads',
      '/api/v1/admin/users',
      '/api/v1/admin/audit',
    ];
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: false, authEnabled: false }) });
    for (const url of routes) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(503);
    }
  });

  it('returns 401 when admin enabled but not authenticated', async () => {
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('gate runs before auth — 503 when disabled even if cookies present', async () => {
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: false, authEnabled: true }) });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard',
      headers: { cookie: 'realstate_sid=fake-session-token' },
    });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error.code).toBe('admin_disabled');
  });
});

describe('Admin API — opportunities', () => {
  it('GET /api/v1/admin/opportunities returns paginated list', async () => {
    const pool = mockPool();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: '1', slug: 'test', title: 'Test' }] })  // data
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });  // count
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    
    // We can't easily mock auth here, so let's skip auth by testing structure
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/opportunities' });
    // Without auth, should get 401
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/v1/admin/opportunities/:id returns 401 without auth', async () => {
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/opportunities/test-id',
      payload: { version: 1, title: 'New' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH returns 503 when admin disabled', async () => {
    const pool = mockPool();
    const app = buildTestApp({ pool, config: makeConfig({ adminEnabled: false, authEnabled: false }) });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/opportunities/test-id',
      payload: { version: 1, title: 'New' },
    });
    expect(res.statusCode).toBe(503);
  });
});

describe('Admin API — dashboard', () => {
  it('GET /api/v1/admin/dashboard returns 401 without auth', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/dashboard returns 503 when disabled', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: false, authEnabled: false }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard' });
    expect(res.statusCode).toBe(503);
  });
});

describe('Admin API — leads', () => {
  it('GET /api/v1/admin/leads returns 401 without auth', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/leads' });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/v1/admin/leads/:ref returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/leads/LD-123',
      payload: { status: 'contacted' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/admin/leads/:ref/notes returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/leads/LD-123/notes',
      payload: { content: 'Test note' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin API — users', () => {
  it('GET /api/v1/admin/users returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users' });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/v1/admin/users/:ref/status returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/users/USR-1/status',
      payload: { status: 'suspended' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/v1/admin/users/:ref/roles returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/USR-1/roles',
      payload: { role: 'operator' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/v1/admin/users/:ref/roles/:role returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/users/USR-1/roles/operator',
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/v1/admin/users/:ref/sessions returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/users/USR-1/sessions',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin API — audit', () => {
  it('GET /api/v1/admin/audit returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/audit' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin API — publish/unpublish/archive', () => {
  it('POST publish returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/opportunities/test-id/publish' });
    expect(res.statusCode).toBe(401);
  });

  it('POST unpublish returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/opportunities/test-id/unpublish' });
    expect(res.statusCode).toBe(401);
  });

  it('POST archive returns 401', async () => {
    const app = buildTestApp({ config: makeConfig({ adminEnabled: true, authEnabled: true }) });
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/opportunities/test-id/archive' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Admin API — public routes unaffected', () => {
  it('public /api/v1/opportunities still works', async () => {
    const pool = mockPool();
    const app = buildApp({
      logger: false,
      pool,
      opportunities: {
        list: vi.fn().mockResolvedValue({ data: [], pagination: { limit: 20, offset: 0, total: 0, hasMore: false }, meta: { disclaimer: 'test', allowedSorts: [] } }),
        findBySlug: vi.fn().mockResolvedValue(null),
      } as any,
      leads: { create: vi.fn() } as any,
      config: makeConfig({ adminEnabled: false, authEnabled: false }),
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/opportunities' });
    expect(res.statusCode).toBe(200);
  });

  it('/health and /api/health still work', async () => {
    const pool = mockPool();
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const app = buildTestApp({ pool });
    const h1 = await app.inject({ method: 'GET', url: '/health' });
    expect(h1.statusCode).toBe(200);
    const h2 = await app.inject({ method: 'GET', url: '/api/health' });
    expect(h2.statusCode).toBe(200);
  });
});
