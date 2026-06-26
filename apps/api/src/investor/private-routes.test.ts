import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import type { KycProvider, StorageProvider } from '../providers/index.js';

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

  function buildApp(pool: MockPool, storage?: Partial<StorageProvider>, kyc?: Partial<KycProvider>) {
    const app = Fastify({ logger: false });
    registerPrivateInvestorRoutes(app, {
      pool: pool as unknown as Pool,
      providers: storage || kyc
        ? {
          storage: (storage ?? {}) as StorageProvider,
          email: {} as never,
          kyc: (kyc ?? {}) as KycProvider,
          signature: {} as never,
          payments: {} as never,
        }
        : undefined,
    });
    return app;
  }

  it('exposes KYC verification status through the Better Auth private API without fake approval', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/verification' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: {
        status: 'not_configured',
        providerStatus: {
          configured: false,
          status: 'not_configured',
          message: 'Proveedor KYC no configurado.',
        },
        canInitiate: false,
        disclaimer: 'El proveedor de verificación de identidad (KYC) no está configurado. No se simula un estado verificado.',
      },
    });
    expect(JSON.stringify(res.json())).not.toMatch(/approved|aprobado|identidad verificada|kyc aprobado/i);
    expect(pool.query).not.toHaveBeenCalled();

    await app.close();
  });

  it('reports KYC provider availability without claiming that the investor is verified', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const app = buildApp(pool, undefined, {
      kind: 'kyc',
      health: async () => ({ configured: true, status: 'ok' }),
    });

    const res = await app.inject({ method: 'GET', url: '/api/investor/verification' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: {
        status: 'not_started',
        providerStatus: {
          configured: true,
          status: 'ok',
          message: 'Proveedor KYC disponible.',
        },
        canInitiate: false,
        disclaimer: 'El proveedor KYC está disponible, pero el inicio de sesión externa todavía no está habilitado para este perfil.',
      },
    });
    expect(JSON.stringify(res.json())).not.toMatch(/approved|aprobado|identidad verificada/i);
    expect(pool.query).not.toHaveBeenCalled();

    await app.close();
  });

  it('keeps KYC initiation disabled and hides internal provider errors when health fails', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    const app = buildApp(pool, undefined, {
      kind: 'kyc',
      health: async () => { throw new Error('raw provider timeout with internal details'); },
    });

    const res = await app.inject({ method: 'GET', url: '/api/investor/verification' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: {
        status: 'not_configured',
        providerStatus: {
          configured: false,
          status: 'error',
          message: 'No se ha podido comprobar el proveedor KYC.',
        },
        canInitiate: false,
        disclaimer: 'El proveedor de verificación de identidad (KYC) no está configurado. No se simula un estado verificado.',
      },
    });
    expect(JSON.stringify(res.json())).not.toContain('raw provider timeout');
    expect(pool.query).not.toHaveBeenCalled();

    await app.close();
  });

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
      data: [{
        id: 'doc_1',
        title: 'Contrato',
        type: 'legal_document',
        status: 'active',
        byte_size: 12345,
        mime_type: 'application/pdf',
        project_slug: 'plaza-america',
        download_available: false,
      }],
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
        rows: [{ id: 'doc_all', title: 'Informe', type: 'quarterly_report', status: 'active', byte_size: 2048, mime_type: 'application/pdf', project_slug: 'plaza-america', storage_ref: 'private/doc.pdf', has_storage_ref: true }],
      })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/documents' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: [{
        id: 'doc_all',
        title: 'Informe',
        type: 'quarterly_report',
        status: 'active',
        byte_size: 2048,
        mime_type: 'application/pdf',
        project_slug: 'plaza-america',
        download_available: false,
      }],
    });
    const firstCall = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    const [sql, params] = firstCall;
    expect(sql).toContain('FROM documents d');
    expect(sql).toContain("NULLIF(d.storage_ref, '') IS NOT NULL AS has_storage_ref");
    expect(sql).toContain('JOIN project_user_access pua ON pua.opportunity_id = o.id');
    expect(sql).not.toContain('private_documents');
    expect(params).toEqual(['app_user_1']);

    await app.close();
  });

  it('only marks downloads available when the document has storage_ref and storage provider is configured', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [
          { id: 'doc_ready', title: 'Contrato firmado', type: 'legal_document', status: 'active', byte_size: 4096, mime_type: 'application/pdf', project_slug: 'plaza-america', storage_ref: 'private/contract.pdf', has_storage_ref: true },
          { id: 'doc_pending', title: 'Certificado pendiente', type: 'compliance', status: 'active', byte_size: null, mime_type: null, project_slug: 'plaza-america', storage_ref: null, has_storage_ref: false },
        ],
      })),
    };
    const app = buildApp(pool, {
      kind: 'storage',
      health: async () => ({ configured: true, status: 'ok' }),
    });

    const res = await app.inject({ method: 'GET', url: '/api/investor/documents' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      data: [
        expect.objectContaining({ id: 'doc_ready', download_available: true }),
        expect.objectContaining({ id: 'doc_pending', download_available: false }),
      ],
    });
    expect(JSON.stringify(res.json())).not.toContain('storage_ref');

    await app.close();
  });

  it('rejects invalid document ids before querying the documents table', async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/projects/plaza-america/documents/not-a-uuid/download' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_document_id');
    expect(pool.query).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns provider_not_configured instead of a fake URL when storage is disabled', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rows: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Contrato', storage_ref: 'docs/contract.pdf' }],
      })),
    };
    const app = buildApp(pool);

    const res = await app.inject({ method: 'GET', url: '/api/investor/projects/plaza-america/documents/11111111-1111-4111-8111-111111111111/download' });

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
