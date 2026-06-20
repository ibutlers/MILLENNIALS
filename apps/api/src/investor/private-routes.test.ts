import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

type MockPool = { query: ReturnType<typeof vi.fn> };

vi.mock('../auth/middleware.js', () => ({
  requireBetterAuthSession: () => async (request: FastifyRequest) => {
    (request as FastifyRequest & { betterAuthSession?: unknown }).betterAuthSession = {
      user: { id: 'ba_user_1', email: 'investor@example.com', emailVerified: true, twoFactorEnabled: true },
      session: { id: 'sess_1', expiresAt: new Date(Date.now() + 3600000), token: 'tok_test' },
    };
  },
  requireActiveAppUser: () => async (request: FastifyRequest) => {
    (request as FastifyRequest & { appUser?: unknown }).appUser = {
      id: 'app_user_1',
      betterAuthUserId: 'ba_user_1',
      emailNormalized: 'investor@example.com',
      displayName: 'Investor',
      role: 'investor',
      status: 'active',
      emailVerifiedAt: new Date().toISOString(),
      mfaEnabledAt: new Date().toISOString(),
      activatedAt: new Date().toISOString(),
    };
  },
  requireVerifiedEmail: () => async () => {},
  requireMfa: () => async () => {},
  requireProjectAccess: () => async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    if (params.id === 'blocked-project') {
      return reply.status(403).send({ error: { code: 'forbidden' } });
    }
    (request as FastifyRequest & { projectAccess?: unknown }).projectAccess = { projectId: params.id, granted: true };
  },
}));

const { registerPrivateInvestorRoutes } = await import('./private-routes.js');

describe('Private investor routes — project documents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildApp(pool: MockPool) {
    const app = Fastify({ logger: false });
    registerPrivateInvestorRoutes(app, { pool: pool as unknown as Pool });
    return app;
  }

  it('lists active private documents from the canonical documents table using id or slug', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: 'doc_1', title: 'Contrato', type: 'legal_document', status: 'active', byte_size: 12345, mime_type: 'application/pdf', project_slug: 'plaza-america' }],
      })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/projects/plaza-america/documents' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: [{ id: 'doc_1', title: 'Contrato', type: 'legal_document', status: 'active', byte_size: 12345, mime_type: 'application/pdf', project_slug: 'plaza-america' }],
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    const firstCall = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    const [sql, params] = firstCall;
    expect(sql).toContain('FROM documents d');
    expect(sql).toContain("d.owner_type = 'opportunity'");
    expect(sql).toContain("d.status = 'active'");
    expect(sql).toContain("d.visibility = 'private'");
    expect(sql).toContain('JOIN opportunities o ON o.id = d.owner_id');
    expect(sql).toContain('(o.id::text = $1 OR o.slug = $1)');
    expect(sql).not.toContain('private_documents');
    expect(params).toEqual(['plaza-america']);

    await app.close();
  });

  it('lists all authorized private documents without querying private_documents', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: 'doc_all', title: 'Informe', type: 'quarterly_report', status: 'active', byte_size: 2048, mime_type: 'application/pdf', project_slug: 'plaza-america' }],
      })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/documents' });

    expect(res.statusCode).toBe(200);
    const firstCall = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    const [sql, params] = firstCall;
    expect(sql).toContain('FROM documents d');
    expect(sql).toContain('JOIN project_user_access pua ON pua.opportunity_id = o.id');
    expect(sql).not.toContain('private_documents');
    expect(params).toEqual(['app_user_1']);

    await app.close();
  });

  it('returns provider_not_configured instead of a fake URL when storage is disabled', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: '00000000-0000-0000-0000-000000000001', title: 'Contrato', storage_ref: 'docs/contract.pdf' }],
      })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/projects/plaza-america/documents/00000000-0000-0000-0000-000000000001/download' });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('provider_not_configured');
    const firstCall = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(firstCall[0]).not.toContain('private_documents');

    await app.close();
  });

  it('does not query documents when the project access guard rejects the investor', async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/projects/blocked-project/documents' });

    expect(res.statusCode).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();

    await app.close();
  });
});
