/**
 * Better Auth core email-verification regression test.
 *
 * Product flow: invitation -> email+password -> verification LINK -> TOTP -> active.
 * This test proves the core `emailVerification.sendVerificationEmail` path and
 * protects against replacing email verification with email OTP.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { runMigrations } from '../db/migrate.js';
import { createBetterAuthServer } from './better-auth-server.js';
import { CaptureEmailProvider, getCapturedEmails } from './email-provider.js';
import type { AppConfig } from '../config.js';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS_DIR = resolve(ROOT, 'apps/api/src/db/migrations');

interface EphemeralPostgres {
  containerName: string;
  volumeName: string;
  dbUrl: string;
}

function runNoFail(cmd: string): void {
  try { execSync(cmd, { stdio: 'pipe' }); } catch { /* best effort cleanup */ }
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        server.close(() => resolvePort(addr.port));
      } else {
        server.close(() => reject(new Error('No free port')));
      }
    });
  });
}

async function startPostgres(): Promise<EphemeralPostgres> {
  const id = randomBytes(6).toString('hex');
  const containerName = `realstate-ba-core-${id}`;
  const volumeName = `realstate-ba-core-vol-${id}`;
  const password = randomBytes(24).toString('hex');
  const port = await getFreePort();

  runNoFail(`docker rm -f ${containerName}`);
  runNoFail(`docker volume rm -f ${volumeName}`);
  execSync(`docker volume create ${volumeName}`, { stdio: 'pipe' });
  execSync(
    `docker run -d --name ${containerName} ` +
    `-v ${volumeName}:/var/lib/postgresql/data ` +
    `-e POSTGRES_USER=realstate ` +
    `-e POSTGRES_PASSWORD=${password} ` +
    `-e POSTGRES_DB=realstate_test ` +
    `-e POSTGRES_INITDB_ARGS='--auth-host=scram-sha-256 --auth-local=scram-sha-256' ` +
    `-p 127.0.0.1:${port}:5432 postgres:16-alpine`,
    { stdio: 'pipe' },
  );

  for (let i = 0; i < 60; i++) {
    try {
      execSync(
        `docker exec -e PGPASSWORD=${password} ${containerName} psql -U realstate -h 127.0.0.1 -d realstate_test -c 'SELECT 1'`,
        { stdio: 'pipe', timeout: 5000 },
      );
      return {
        containerName,
        volumeName,
        dbUrl: `postgresql://realstate:${encodeURIComponent(password)}@127.0.0.1:${port}/realstate_test`,
      };
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  try {
    const logs = execSync(`docker logs ${containerName} 2>&1`, { encoding: 'utf8', timeout: 5000 });
    console.info(logs.split('\n').slice(-20).join('\n'));
  } catch { /* ignore diagnostics failure */ }
  runNoFail(`docker rm -f ${containerName}`);
  runNoFail(`docker volume rm -f ${volumeName}`);
  throw new Error('PostgreSQL not ready');
}

function cleanup(pg: EphemeralPostgres | undefined): void {
  if (!pg) return;
  runNoFail(`docker rm -f ${pg.containerName}`);
  runNoFail(`docker volume rm -f ${pg.volumeName}`);
}

function config(): AppConfig {
  return {
    appBaseUrl: 'http://127.0.0.1:8090',
    authAllowInsecureIpTest: false,
    authMode: 'better-auth',
    authEnabled: true,
    registrationEnabled: true,
    emailDeliveryEnabled: false,
    sessionCookieSecure: false,
    sessionTtlSeconds: 28800,
    sessionIdleTtlSeconds: 3600,
    emailVerificationTtlSeconds: 3600,
    passwordResetTtlSeconds: 1800,
    authRateLimitMax: 10000,
    authRateLimitWindowMs: 900000,
    betterAuthSecret: randomBytes(32).toString('hex'),
    betterAuthUrl: 'http://127.0.0.1:8090',
    betterAuthTrustedOrigins: ['http://127.0.0.1:8090'],
    betterAuthCookiePrefix: 'mc',
    betterAuthRequire2FA: true,
    authEmailMode: 'capture',
    authEmailFrom: 'e2e@realstate.test',
    authEmailReplyTo: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    authInvitationTtlHours: 48,
    authSessionExpiresHours: 8,
    authPasswordMinLength: 12,
    adminEnabled: false,
    adminMediaUploadEnabled: false,
    demoSeedEnabled: false,
    leadsEnabled: true,
    leadsRateLimitMax: 10000,
    leadsRateLimitWindowMs: 900000,
    e2eTestMode: true,
    e2eInternalSecret: randomBytes(32).toString('hex'),
    privacyControllerName: 'Realstate Test',
    privacyContactEmail: 'privacy@example.test',
    privacyPolicyVersion: 'test',
  };
}

describe('Better Auth core email verification', () => {
  let pg: EphemeralPostgres | undefined;
  let pool: Pool;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    pg = await startPostgres();
    process.env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: pg.dbUrl,
      MIGRATIONS_DIR,
    };
    pool = new Pool({ connectionString: pg.dbUrl, max: 5 });
    await runMigrations(pool);
  }, 90_000);

  afterAll(async () => {
    await pool?.end();
    cleanup(pg);
    process.env = originalEnv;
  });

  it('signUpEmail invokes core sendVerificationEmail once on the same capture provider', async () => {
    const emailProvider = new CaptureEmailProvider();
    const authPool = new Pool({
      connectionString: `${pg!.dbUrl}${pg!.dbUrl.includes('?') ? '&' : '?'}options=-c%20search_path%3Dauth,public`,
      max: 3,
    });
    try {
      const auth = createBetterAuthServer(authPool, config(), emailProvider);
      const email = `core-${randomBytes(4).toString('hex')}@e2e.test`;
      const callbackURL = '/acceso/verificar';

      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password: 'ValidPassword123!',
          name: 'Core Verification',
          callbackURL,
        },
        headers: new Headers({ origin: 'http://127.0.0.1:8090' }),
      });

      expect(signUpResult.user.email).toBe(email);
      expect(signUpResult.token).toBeNull();
      const captured = emailProvider.sent.filter((item) => item.to === email && item.type === 'verification');
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toMatch(/^http:\/\/127\.0\.0\.1:8090\/api\/auth\/verify-email\?token=/);
      expect(getCapturedEmails()).toEqual([]);

      const localUser = await pool.query('SELECT id FROM app_users WHERE email_normalized = $1', [email]);
      expect(localUser.rowCount).toBe(0);
    } finally {
      await authPool.end();
    }
  }, 30_000);
});
