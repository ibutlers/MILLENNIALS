/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireMfa } from './middleware.js';

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
