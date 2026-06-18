import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { getConfig, rejectInsecureAuth as rejectInsecureAppConfig } from './config.js';
import { registerSchema } from './auth/schemas.js';
import { hashPassword, verifyPassword } from './auth/password.js';
import { createSessionToken, hashToken } from './auth/sessions.js';
import { rejectInsecureAuth } from './auth/config.js';
import { TestEmailTransport } from './auth/email.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthRepo() {
  return {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async (input: { email: string; emailNormalized: string; passwordHash: string; name: string }) => ({
      id: '00000000-0000-0000-0000-000000000001',
      email: input.email,
      status: 'active',
      createdAt: new Date().toISOString(),
    })),
    findSessionByTokenHash: vi.fn(async () => null),
    createSession: vi.fn(async () => ({
      id: 'session-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })),
    updateLastLogin: vi.fn(async () => {}),
    createVerificationToken: vi.fn(async () => 'verifyhash'),
    consumeVerificationToken: vi.fn(async () => null),
    verifyEmail: vi.fn(async () => {}),
    createPasswordResetToken: vi.fn(async () => 'resethash'),
    consumePasswordResetToken: vi.fn(async () => null),
    updatePassword: vi.fn(async () => {}),
    revokeUserSessions: vi.fn(async () => {}),
    revokeSession: vi.fn(async () => {}),
    touchSession: vi.fn(async () => {}),
    listUserSessions: vi.fn(async () => []),
    recordAuditEvent: vi.fn(async () => {}),
    findUserById: vi.fn(async () => null),
    getUserRoles: vi.fn(async () => ['investor']),
  };
}

const pool = {
  query: vi.fn(async (sql: string) =>
    sql.includes('SELECT 1') ? { rows: [{ '?column?': 1 }] } : { rows: [] },
  ),
} as never;

const emailTransport = new TestEmailTransport();
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

const baseAuthConfig = {
  authEnabled: true,
  registrationEnabled: true,
  emailDeliveryEnabled: false,
  e2eTestMode: false,
  appBaseUrl: 'https://localhost:8088',
  sessionCookieSecure: false,
  sessionTtlSeconds: 86400,
  sessionIdleTtlSeconds: 3600,
  emailVerificationTtlSeconds: 1800,
  passwordResetTtlSeconds: 1800,
  authRateLimitMax: 100,
  authRateLimitWindowMs: 900_000,
};

function buildTestApp(repoOverrides: Record<string, unknown> = {}, configOverrides: Record<string, unknown> = {}) {
  const repo = { ...mockAuthRepo(), ...repoOverrides };
  const config = { ...baseAuthConfig, ...configOverrides };
  return buildApp({
    logger: false,
    pool,
    opportunities: {} as never,
    leads: { create: vi.fn() } as never,
    auth: { repo, emailTransport } as never,
    config,
  });
}

// ---------------------------------------------------------------------------
// 1. Schema tests
// ---------------------------------------------------------------------------

describe('auth schemas', () => {
  it('registerSchema rejects bad email', () => {
    expect(() => registerSchema.parse({ email: 'not-an-email', password: 'Abc1234!', name: 'Test' })).toThrow();
  });

  it('registerSchema rejects short password', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'Ab1!', name: 'Test' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Password hashing
// ---------------------------------------------------------------------------

describe('password hashing (Argon2id)', () => {
  it('hashPassword and verifyPassword work', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('CorrectHorseBatteryStaple!', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword!', hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Sessions
// ---------------------------------------------------------------------------

describe('session tokens', () => {
  it('createSessionToken is not empty, hashToken is deterministic', () => {
    const token = createSessionToken();
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(43);
    const hashed = hashToken(token);
    expect(hashed).toBeTruthy();
    expect(hashToken(token)).toBe(hashed);
  });
});

// ---------------------------------------------------------------------------
// 4. Config
// ---------------------------------------------------------------------------

describe('config validation', () => {
  it('getConfig defaults e2eTestMode to false when E2E_TEST_MODE is absent', () => {
    delete process.env.E2E_TEST_MODE;
    expect(getConfig().e2eTestMode).toBe(false);
  });

  it('getConfig keeps e2eTestMode false when E2E_TEST_MODE=false', () => {
    process.env.E2E_TEST_MODE = 'false';
    expect(getConfig().e2eTestMode).toBe(false);
  });

  it('allows explicit E2E mode only in isolated localhost test environments', () => {
    process.env.NODE_ENV = 'e2e';
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        authEnabled: true,
        adminEnabled: true,
        e2eTestMode: true,
        e2eInternalSecret: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        appBaseUrl: 'http://127.0.0.1:8089',
      }),
    ).not.toThrow();
  });

  it('rejects E2E_TEST_MODE=true in production startup config', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        e2eTestMode: true,
        appBaseUrl: 'https://realstate.example',
      }),
    ).toThrow(/E2E_TEST_MODE/);
  });

  it('rejects E2E mode without an internal secret', () => {
    process.env.NODE_ENV = 'e2e';
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        e2eTestMode: true,
        e2eInternalSecret: undefined,
        appBaseUrl: 'http://127.0.0.1:8089',
      }),
    ).toThrow(/E2E_INTERNAL_SECRET/);
  });

  it('rejects E2E mode with a short internal secret', () => {
    process.env.NODE_ENV = 'e2e';
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        e2eTestMode: true,
        e2eInternalSecret: 'short',
        appBaseUrl: 'http://127.0.0.1:8089',
      }),
    ).toThrow(/E2E_INTERNAL_SECRET/);
  });

  it('allows the temporary insecure IP override only for the approved production test URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        authMode: 'better-auth',
        authEnabled: true,
        adminEnabled: true,
        authAllowInsecureIpTest: true,
        appBaseUrl: 'http://65.108.251.196:8088',
        betterAuthSecret: 'a'.repeat(64),
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('AUTH_ALLOW_INSECURE_IP_TEST=true'));
  });

  it('rejects the temporary insecure IP override for any non-approved URL', () => {
    expect(() =>
      rejectInsecureAppConfig({
        ...getConfig(),
        authMode: 'better-auth',
        authEnabled: true,
        adminEnabled: true,
        authAllowInsecureIpTest: true,
        appBaseUrl: 'http://example.com',
        betterAuthSecret: 'a'.repeat(64),
      }),
    ).toThrow(/AUTH_ALLOW_INSECURE_IP_TEST/);
  });

  it('rejectInsecureAuth throws with http baseUrl + authEnabled', () => {
    expect(() =>
      rejectInsecureAuth({ ...baseAuthConfig, appBaseUrl: 'http://localhost:8088' }),
    ).toThrow(/https/);
  });

  it('does not register internal E2E token endpoints when e2eTestMode is disabled', async () => {
    const app = buildTestApp({}, { e2eTestMode: false });
    const verification = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/test@example.com' });
    const reset = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/test@example.com' });
    expect(verification.statusCode).toBe(404);
    expect(reset.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 5. API endpoints
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  it('returns 503 when authEnabled=false', async () => {
    const app = buildTestApp({}, { authEnabled: false, appBaseUrl: 'http://localhost:8088' });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'a@b.com', password: 'Abc1234!', name: 'Test' } });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toMatch(/auth_disabled/i);
  });

  it('returns 503 when registrationEnabled=false', async () => {
    const app = buildTestApp({}, { registrationEnabled: false });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'a@b.com', password: 'Abc1234!', name: 'Test' } });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toMatch(/registration_disabled/i);
  });

  it('returns 201 with valid data', async () => {
    const mockCreate = vi.fn(async (input: { email: string; emailNormalized: string; passwordHash: string; name: string }) => ({
      id: 'user-1', email: input.email, status: 'active', createdAt: new Date().toISOString(),
    }));
    const app = buildTestApp({ createUser: mockCreate });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'ada@example.com', password: 'CorrectHorseBatteryStaple!', name: 'Ada' } });
    expect(r.statusCode).toBe(201);
    expect(r.json().data.email).toBe('ada@example.com');
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 401 for wrong password', async () => {
    const pwHash = await hashPassword('CorrectPassword1!');
    const app = buildTestApp({
      findUserByEmail: vi.fn(async () => ({
        id: 'user-1', email: 'ada@example.com', emailNormalized: 'ada@example.com',
        passwordHash: pwHash, status: 'active',
      })),
    });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'ada@example.com', password: 'WrongPassword1!' } });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.code).toMatch(/invalid_credentials/i);
  });

  it('returns 200 and sets cookie for valid credentials', async () => {
    const password = 'CorrectHorseBatteryStaple!';
    const pwHash = await hashPassword(password);
    const app = buildTestApp({
      findUserByEmail: vi.fn(async () => ({
        id: 'user-1', email: 'ada@example.com', emailNormalized: 'ada@example.com',
        passwordHash: pwHash, status: 'active',
      })),
    });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'ada@example.com', password } });
    expect(r.statusCode).toBe(200);
    const sessionCookie = r.cookies.find((c: { name: string }) => c.name === 'realstate_sid');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.httpOnly).toBe(true);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears cookie on logout', async () => {
    const app = buildTestApp({
      findSessionByTokenHash: vi.fn(async () => ({
        id: 'session-1', userId: 'user-1', tokenHash: 'abc',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: null, createdAt: new Date().toISOString(), lastSeenAt: null, userStatus: 'active',
      })),
    });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: 'realstate_sid=sometoken' } });
    expect(r.statusCode).toBe(200);
    const sessionCookie = r.cookies.find((c: { name: string }) => c.name === 'realstate_sid');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.value).toBe('');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without cookie', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(r.statusCode).toBe(401);
  });
});

describe('POST /api/v1/auth/verify-email', () => {
  it('returns 200 with valid token', async () => {
    const app = buildTestApp({
      consumeVerificationToken: vi.fn(async () => ({ userId: 'user-1' })),
    });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: 'valid-token-123' } });
    expect(r.statusCode).toBe(200);
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns generic message', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: 'ada@example.com' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.message).toBeTruthy();
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('returns success with valid token', async () => {
    const app = buildTestApp({
      consumePasswordResetToken: vi.fn(async () => ({ userId: 'user-1' })),
    });
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token: 'valid-reset-token', password: 'NewPassword123!' } });
    expect(r.statusCode).toBe(200);
  });
});

describe('auth disabled globally', () => {
  it('returns 503 on all auth endpoints when authEnabled=false', async () => {
    const app = buildTestApp({}, { authEnabled: false, appBaseUrl: 'http://localhost:8088' });
    const endpoints = ['/register', '/login', '/me', '/verify-email', '/forgot-password', '/reset-password'];
    for (const path of endpoints) {
      const r = await app.inject({ method: path === '/me' ? 'GET' : 'POST', url: `/api/v1/auth${path}`, payload: path !== '/me' ? { email: 'a@b.com', password: 'Abc1234!' } : undefined, headers: path === '/me' ? {} : undefined });
      expect(r.statusCode, `${path} should be 503`).toBe(503);
    }
  });
});


describe('E2E token outbox protection', () => {
  const e2eSecret = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  it('requires x-e2e-secret before exposing verification tokens', async () => {
    const app = buildTestApp({}, { e2eTestMode: true, e2eInternalSecret: e2eSecret });
    const register = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'ada@example.com', password: 'CorrectHorseBatteryStaple!', name: 'Ada' } });
    expect(register.statusCode).toBe(201);

    const missing = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/ada@example.com' });
    const wrong = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/ada@example.com', headers: { 'x-e2e-secret': 'wrong' } });
    expect(missing.statusCode).toBe(404);
    expect(wrong.statusCode).toBe(404);

    const otherEmail = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/other@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(otherEmail.statusCode).toBe(404);

    const ok = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/ada@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.data.token).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(e2eSecret);

    const reused = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/ada@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(reused.statusCode).toBe(404);
  });

  it('expires verification tokens after successful E2E authentication', async () => {
    const app = buildTestApp({}, { e2eTestMode: true, e2eInternalSecret: e2eSecret, emailVerificationTtlSeconds: -1 });
    const register = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'expired@example.com', password: 'CorrectHorseBatteryStaple!', name: 'Expired' } });
    expect(register.statusCode).toBe(201);

    const expired = await app.inject({ method: 'GET', url: '/api/v1/e2e/verification-token/expired@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(expired.statusCode).toBe(410);
  });

  it('protects password reset tokens with the same E2E secret and one-use semantics', async () => {
    const app = buildTestApp({
      findUserByEmail: vi.fn(async () => ({ id: 'user-1', email: 'ada@example.com', emailNormalized: 'ada@example.com', passwordHash: 'hash', status: 'active' })),
    }, { e2eTestMode: true, e2eInternalSecret: e2eSecret });

    const request = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: 'ada@example.com' } });
    expect(request.statusCode).toBe(200);

    const missing = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/ada@example.com' });
    const wrong = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/ada@example.com', headers: { 'x-e2e-secret': 'wrong' } });
    expect(missing.statusCode).toBe(404);
    expect(wrong.statusCode).toBe(404);

    const ok = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/ada@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.data.token).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(e2eSecret);

    const reused = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/ada@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(reused.statusCode).toBe(404);
  });

  it('expires password reset tokens after successful E2E authentication', async () => {
    const app = buildTestApp({
      findUserByEmail: vi.fn(async () => ({ id: 'user-1', email: 'ada@example.com', emailNormalized: 'ada@example.com', passwordHash: 'hash', status: 'active' })),
    }, { e2eTestMode: true, e2eInternalSecret: e2eSecret, passwordResetTtlSeconds: -1 });

    const request = await app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', payload: { email: 'ada@example.com' } });
    expect(request.statusCode).toBe(200);

    const expired = await app.inject({ method: 'GET', url: '/api/v1/e2e/password-reset-token/ada@example.com', headers: { 'x-e2e-secret': e2eSecret } });
    expect(expired.statusCode).toBe(410);
  });
});
