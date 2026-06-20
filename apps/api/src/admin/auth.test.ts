/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireRole } from './auth.js';
import { setBetterAuthServer } from '../auth/better-auth-plugin.js';

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

function setBetterAuthSession(twoFactorEnabled: boolean) {
  setBetterAuthServer({
    handler: vi.fn(),
    api: {
      getSession: vi.fn(async () => ({
        user: {
          id: 'ba-admin-1',
          email: 'admin@mc.test',
          name: 'Admin',
          emailVerified: true,
          twoFactorEnabled,
        },
        session: {
          id: 'session-1',
          expiresAt: new Date(Date.now() + 60_000),
          token: 'session-token-for-test',
        },
      })),
      signOut: vi.fn(),
    },
  } as any);
}

function makePool() {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM app_users')) {
        return {
          rows: [{
            id: 'app-admin-1',
            role: 'admin',
            status: 'active',
            email_verified_at: new Date(),
            mfa_enabled_at: null,
          }],
        };
      }
      return { rows: [] };
    }),
  };
}

describe('admin auth — MFA opcional vs obligatorio', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BETTER_AUTH_REQUIRE_2FA;
    setBetterAuthSession(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('permite admin activo y email verificado sin MFA cuando BETTER_AUTH_REQUIRE_2FA no está definido', async () => {
    const request: any = { headers: {} };
    const reply = makeReply();

    await requireRole(makePool() as any, 'admin')(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(request._authUser).toMatchObject({ userId: 'app-admin-1', roles: ['admin'] });
  });

  it('permite admin activo y email verificado sin MFA cuando BETTER_AUTH_REQUIRE_2FA=false', async () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'false';
    const request: any = { headers: {} };
    const reply = makeReply();

    await requireRole(makePool() as any, 'admin')(request, reply);

    expect(reply.status).not.toHaveBeenCalled();
    expect(request._authUser).toMatchObject({ userId: 'app-admin-1', roles: ['admin'] });
  });

  it('bloquea admin activo sin MFA cuando BETTER_AUTH_REQUIRE_2FA=true', async () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'true';
    const request: any = { headers: {} };
    const reply = makeReply();

    await requireRole(makePool() as any, 'admin')(request, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.payload).toMatchObject({ error: { code: 'mfa_required' } });
    expect(request._authUser).toBeUndefined();
  });
});
