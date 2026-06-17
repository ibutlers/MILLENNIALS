/**
 * E2E Auth Helpers — Test-only endpoints for automated auth testing.
 *
 * Protected by x-e2e-secret header and only registered when
 * E2E_TEST_MODE=true AND AUTH_MODE=better-auth.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { timingSafeEqual } from 'node:crypto';

function safeSecretMatches(provided: unknown, expected: string | undefined): boolean {
  if (typeof provided !== 'string' || !expected) return false;
  try {
    const a = Buffer.from(provided.slice(0, 256));
    const b = Buffer.from(expected.slice(0, 256));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function e2eNotFound(): { error: { code: string; message: string } } {
  return { error: { code: 'not_found', message: 'Not found' } };
}

export function registerE2EAuthHelpers(
  app: FastifyInstance,
  pool: Pool,
  config: AppConfig,
): void {
  if (!config.e2eTestMode) return;

  const secret = config.e2eInternalSecret;

  // ── GET /api/e2e/auth/totp-uri?email=... ──
  // Returns the TOTP URI for a user (by Better Auth user ID from email in auth.user table).
  // Requires x-e2e-secret header.
  app.get('/api/e2e/auth/totp-uri', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers['x-e2e-secret'];
    if (!safeSecretMatches(header, secret)) {
      return reply.status(404).send(e2eNotFound());
    }

    const { email } = request.query as { email?: string };
    if (!email) {
      return reply.status(400).send({ error: { code: 'bad_request', message: 'email query param required' } });
    }

    try {
      // Find user in auth.user table
      const userResult = await pool.query<{ id: string }>(
        `SELECT id FROM auth."user" WHERE email = $1`,
        [email],
      );
      if (userResult.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'User not found' } });
      }
      const userId = userResult.rows[0].id;

      // Find TOTP secret in auth.twoFactor
      const tfResult = await pool.query<{ secret: string }>(
        `SELECT secret FROM auth."twoFactor" WHERE "userId" = $1`,
        [userId],
      );
      if (tfResult.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'TOTP not set up' } });
      }

      const secretKey = tfResult.rows[0].secret;
      const issuer = 'MILLENNIALS CONSTRUYEN';
      const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretKey}&issuer=${encodeURIComponent(issuer)}`;

      return { data: { uri, secret: secretKey } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e totp-uri error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── GET /api/e2e/auth/captured-emails ──
  // Returns captured emails from the in-memory capture provider.
  // Requires x-e2e-secret header.
  app.get('/api/e2e/auth/captured-emails', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers['x-e2e-secret'];
    if (!safeSecretMatches(header, secret)) {
      return reply.status(404).send(e2eNotFound());
    }

    try {
      // The capture email provider stores emails in a global array.
      // We access it via a module-level export.
      const { getCapturedEmails } = await import('../auth/email-provider.js');
      const emails = getCapturedEmails();
      return { data: emails };
    } catch (error) {
      request.log.error({ err: error }, 'e2e captured-emails error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── DELETE /api/e2e/auth/captured-emails ──
  // Clears captured emails.
  app.delete('/api/e2e/auth/captured-emails', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers['x-e2e-secret'];
    if (!safeSecretMatches(header, secret)) {
      return reply.status(404).send(e2eNotFound());
    }

    try {
      const { clearCapturedEmails } = await import('../auth/email-provider.js');
      clearCapturedEmails();
      return { data: { cleared: true } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e clear-emails error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });
}
