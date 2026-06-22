/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireMfa, requireProjectAccess } from './middleware.js';

const originalEnv = process.env;

function makeReply() {
  const reply: any = {
    statusCode: undefined as number | undefined,
    payload: undefined as unknown,
    status: vi.fn((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: vi.fn((payload: unknown) => {
      reply.payload = payload;
      return reply;
    }),
  };
  return reply;
}

function makeRequest({ twoFactorEnabled, mfaEnabledAt }: { twoFactorEnabled: boolean; mfaEnabledAt: string | null }) {
  return {
    appUser: {
      id: 'app-user-1',
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date().toISOString(),
      mfaEnabledAt,
    },
    betterAuthSession: {
      user: { id: 'ba-user-1', twoFactorEnabled },
    },
  } as any;
}

describe('requireMfa — MFA opcional vs obligatorio', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BETTER_AUTH_REQUIRE_2FA;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('no bloquea cuentas activas sin TOTP cuando BETTER_AUTH_REQUIRE_2FA no está definido', async () => {
    const reply = makeReply();

    await requireMfa()(makeRequest({ twoFactorEnabled: false, mfaEnabledAt: null }), reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('no bloquea cuentas activas sin TOTP cuando BETTER_AUTH_REQUIRE_2FA=false', async () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'false';
    const reply = makeReply();

    await requireMfa()(makeRequest({ twoFactorEnabled: false, mfaEnabledAt: null }), reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('bloquea cuentas sin TOTP solo cuando BETTER_AUTH_REQUIRE_2FA=true', async () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'true';
    const reply = makeReply();

    await requireMfa()(makeRequest({ twoFactorEnabled: false, mfaEnabledAt: null }), reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.payload).toMatchObject({ error: { code: 'mfa_required' } });
  });
});

describe('requireProjectAccess — validación de referencia de proyecto', () => {
  it('rechaza referencias inseguras antes de consultar permisos', async () => {
    const pool = { query: vi.fn() } as any;
    const reply = makeReply();
    const request = {
      appUser: { id: 'app-user-1', role: 'investor' },
      params: { id: '../secret' },
    } as any;

    await requireProjectAccess(pool)(request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.payload).toMatchObject({ error: { code: 'invalid_project_reference' } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('consulta permisos con SQL parametrizado para referencias seguras', async () => {
    const pool = { query: vi.fn(async () => ({ rows: [{ '?column?': 1 }] })) } as any;
    const reply = makeReply();
    const request = {
      appUser: { id: 'app-user-1', role: 'investor' },
      params: { id: 'plaza-america' },
    } as any;

    await requireProjectAccess(pool)(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('WHERE pua.app_user_id = $1');
    expect(sql).toContain('(o.id::text = $2 OR o.slug = $2)');
    expect(params).toEqual(['app-user-1', 'plaza-america']);
    expect(request.projectAccess).toEqual({ projectId: 'plaza-america', granted: true });
  });
});
