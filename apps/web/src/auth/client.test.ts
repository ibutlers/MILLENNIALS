import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthDisabledError, InvalidCredentialsError, fetchMe, resetPassword } from './client';

const user = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@e2e.realstate.test',
  name: 'Admin E2E',
  roles: ['admin'],
  status: 'active',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function mockFetch(status: number, body: unknown, jsonThrows = false) {
  globalThis.fetch = vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (jsonThrows) throw new Error('invalid json');
      return body;
    },
  } as Response));
}

describe('auth client fetchMe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the root user contract for a valid 200 response', async () => {
    mockFetch(200, user);

    await expect(fetchMe()).resolves.toEqual(user);
  });

  it('throws InvalidCredentialsError for 401 unauthenticated responses', async () => {
    mockFetch(401, { error: { code: 'unauthorized' } });

    await expect(fetchMe()).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws AuthDisabledError for 503 auth_disabled responses', async () => {
    mockFetch(503, { error: { code: 'auth_disabled' } });

    await expect(fetchMe()).rejects.toBeInstanceOf(AuthDisabledError);
  });

  it('throws a controlled error for malformed JSON', async () => {
    mockFetch(200, null, true);

    await expect(fetchMe()).rejects.toThrow('invalid json');
  });

  it('returns nested data wrapper when API returns { data: user }', async () => {
    mockFetch(200, { data: user });

    await expect(fetchMe()).resolves.toEqual({ data: user });
  });
});

describe('auth client password reset', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Better Auth invalid reset tokens to a safe recovery message', async () => {
    mockFetch(400, { code: 'INVALID_TOKEN', message: 'Invalid token' });

    await expect(resetPassword('invalid-reset-token', 'NewPassword123!')).rejects.toThrow(
      'El enlace de restablecimiento no es válido o ha caducado.',
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/reset-password?token=invalid-reset-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ newPassword: 'NewPassword123!' }),
      }),
    );
  });
});
