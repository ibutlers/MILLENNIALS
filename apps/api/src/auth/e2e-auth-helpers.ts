/** 
 * E2E Auth Helpers — Test-only endpoints for automated auth testing.
 *
 * Protected by x-e2e-secret header and only registered when
 * E2E_TEST_MODE=true AND AUTH_MODE=better-auth.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function registerE2EAuthHelpers(
  app: FastifyInstance,
  pool: Pool,
  config: AppConfig,
): void {
  if (!config.e2eTestMode) return;

  const secret = config.e2eInternalSecret;
  const secretFingerprint = secret
    ? createHash('sha256').update(`realstate-e2e-auth:${secret}`).digest('hex').slice(0, 16)
    : 'no-secret';

  // ── GET /api/e2e/auth/fingerprint ──
  // Returns a short hash of the E2E secret so Playwright can validate it matches
  // before running auth-dependent tests. Never exposes the full secret.
  app.get('/api/e2e/auth/fingerprint', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ data: { fingerprint: secretFingerprint } });
  });

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

  // ── POST /api/e2e/auth/force-verify-email ──
  // Directly marks a user's email as verified and transitions status to pending_mfa.
  // Bypasses Better Auth's email verification flow entirely.
  // Only available in E2E test mode with valid x-e2e-secret.
  app.post('/api/e2e/auth/force-verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers['x-e2e-secret'];
    if (!safeSecretMatches(header, secret)) {
      return reply.status(404).send(e2eNotFound());
    }

    const body = request.body as { email?: string } | undefined;
    const email = body?.email?.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: { code: 'bad_request', message: 'email required in body' } });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update auth.user email_verified flag
      const userResult = await client.query(
        `UPDATE auth."user" SET email_verified = true WHERE email = $1 RETURNING id`,
        [email],
      );
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: { code: 'not_found', message: 'Better Auth user not found' } });
      }
      const baUserId = userResult.rows[0].id;

      // 2. Update app_users status: pending_email → pending_mfa
      const appResult = await client.query(
        `UPDATE app_users SET status = 'pending_mfa', email_verified_at = now(), updated_at = now()
         WHERE better_auth_user_id = $1 AND status = 'pending_email'
         RETURNING id, status`,
        [baUserId],
      );
      if (appResult.rows.length === 0) {
        // Already transitioned or wrong status — idempotent, not an error
      }

      await client.query('COMMIT');
      return { data: { email, baUserId, status: 'pending_mfa' } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      request.log.error({ err: error }, 'e2e force-verify-email error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    } finally {
      client.release();
    }
  });

  // ── GET /api/e2e/auth/verification-token?email=... ──
  // Returns the latest email verification token for a user (from auth.verification).
  // Bypasses the email capture system — reads directly from the DB.
  // Requires x-e2e-secret header. Only in E2E test mode.
  app.get('/api/e2e/auth/verification-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers['x-e2e-secret'];
    if (!safeSecretMatches(header, secret)) {
      return reply.status(404).send(e2eNotFound());
    }

    const { email } = request.query as { email?: string };
    if (!email) {
      return reply.status(400).send({ error: { code: 'bad_request', message: 'email query param required' } });
    }

    try {
      const result = await pool.query<{ value: string; id: string }>(
        `SELECT id, value FROM auth.verification
         WHERE identifier = $1
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [email.toLowerCase().trim()],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'No verification token found for this email' } });
      }
      return { data: { token: result.rows[0].value } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e verification-token error');
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

  // ── POST /api/e2e/auth/invitation-token ──
  // Creates an invitation and returns the raw token for E2E testing.
  app.post('/api/e2e/auth/invitation-token', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email, role } = request.body as { email: string; name?: string; role?: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      const intendedRole = role || 'investor';

      // Check for existing active user
      const existing = await pool.query(`SELECT id FROM app_users WHERE email_normalized = $1`, [normalized]);
      if (existing.rows.length > 0) {
        return reply.status(409).send({ error: { code: 'conflict', message: 'User already exists' } });
      }

      // Expire any existing pending invitations for this email to satisfy
      // the access_invitations_single_active exclusion constraint
      await pool.query(
        `UPDATE access_invitations SET status = 'revoked', revoked_at = now(), revocation_reason = 'replaced_by_new_e2e_invitation'
         WHERE email_normalized = $1 AND status = 'pending'`,
        [normalized],
      );

      // Generate token
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const publicRef = `INV-${randomBytes(4).toString('hex')}`;

      // Insert invitation
      const invResult = await pool.query(
        `INSERT INTO access_invitations (public_reference, email_normalized, token_hash, intended_role, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, 'pending', now() + interval '48 hours', now())
         RETURNING id, public_reference`,
        [publicRef, normalized, tokenHash, intendedRole],
      );
      const invitation = invResult.rows[0];

      // Record audit (actor_id and subject_id are NULL — system action, no user yet)
      await pool.query(
        `INSERT INTO auth_audit_events (action, resource_type, resource_id, result, metadata)
         VALUES ('invitation_created', 'access_invitation', $1, 'success', $2)`,
        [invitation.id, JSON.stringify({ email: normalized, role: intendedRole })],
      );

      return { data: { token: rawToken, reference: invitation.public_reference, email: normalized } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e invitation-token error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/grant-project ──
  app.post('/api/e2e/auth/grant-project', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email, projectSlug } = request.body as { email: string; projectSlug: string };
      if (!email || !projectSlug) {
        return reply.status(400).send({ error: { code: 'bad_request', message: 'email and projectSlug required' } });
      }
      const normalized = email.toLowerCase().trim();

      const user = await pool.query(`SELECT id FROM app_users WHERE email_normalized = $1 AND status = 'active'`, [normalized]);
      if (user.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Active user not found' } });
      }

      const project = await pool.query(`SELECT id FROM opportunities WHERE slug = $1`, [projectSlug]);
      if (project.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'Project not found' } });
      }

      await pool.query(
        `INSERT INTO project_user_access (app_user_id, opportunity_id, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (app_user_id, opportunity_id)
         DO UPDATE SET status = 'active', granted_at = now(), revoked_at = NULL`,
        [user.rows[0].id, project.rows[0].id],
      );

      return { data: { granted: true, user: user.rows[0].id, project: project.rows[0].id } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e grant-project error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/suspend-user ──
  app.post('/api/e2e/auth/suspend-user', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.body as { email: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      await pool.query(
        `UPDATE app_users SET status = 'suspended', suspended_at = now(), updated_at = now()
         WHERE email_normalized = $1 AND status = 'active'`,
        [normalized],
      );
      return { data: { suspended: true } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e suspend-user error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/reactivate-user ──
  app.post('/api/e2e/auth/reactivate-user', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.body as { email: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      await pool.query(
        `UPDATE app_users SET status = 'active', suspended_at = NULL, updated_at = now()
         WHERE email_normalized = $1 AND status = 'suspended'`,
        [normalized],
      );
      return { data: { reactivated: true } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e reactivate-user error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/revoke-project ──
  app.post('/api/e2e/auth/revoke-project', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email, projectSlug } = request.body as { email: string; projectSlug: string };
      if (!email || !projectSlug) {
        return reply.status(400).send({ error: { code: 'bad_request', message: 'email and projectSlug required' } });
      }
      const normalized = email.toLowerCase().trim();

      const user = await pool.query(`SELECT id FROM app_users WHERE email_normalized = $1`, [normalized]);
      const project = await pool.query(`SELECT id FROM opportunities WHERE slug = $1`, [projectSlug]);
      if (user.rows.length === 0 || project.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'User or project not found' } });
      }

      await pool.query(
        `UPDATE project_user_access SET status = 'revoked', revoked_at = now()
         WHERE app_user_id = $1 AND opportunity_id = $2 AND status = 'active'`,
        [user.rows[0].id, project.rows[0].id],
      );
      return { data: { revoked: true } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e revoke-project error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/create-expired-invitation ──
  app.post('/api/e2e/auth/create-expired-invitation', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.body as { email: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await pool.query(
        `INSERT INTO access_invitations (public_reference, email_normalized, token_hash, intended_role, status, expires_at, created_at)
         VALUES ($1, $2, $3, 'investor', 'expired', now() - interval '1 second', now() - interval '49 hours')`,
        [`INV-EXP-${randomBytes(4).toString('hex')}`, normalized, tokenHash],
      );

      return { data: { token: rawToken, email: normalized } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e create-expired-invitation error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── POST /api/e2e/auth/create-revoked-invitation ──
  app.post('/api/e2e/auth/create-revoked-invitation', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.body as { email: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);

      await pool.query(
        `INSERT INTO access_invitations (public_reference, email_normalized, token_hash, intended_role, status, expires_at, created_at, revoked_at)
         VALUES ($1, $2, $3, 'investor', 'revoked', now() + interval '48 hours', now(), now())`,
        [`INV-REV-${randomBytes(4).toString('hex')}`, normalized, tokenHash],
      );

      return { data: { token: rawToken, email: normalized } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e create-revoked-invitation error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── GET /api/e2e/auth/user-status?email=... ──
  app.get('/api/e2e/auth/user-status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.query as { email?: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      const result = await pool.query(
        `SELECT id, email_normalized, display_name, role, status, email_verified_at, mfa_enabled_at
         FROM app_users WHERE email_normalized = $1`,
        [normalized],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'User not found' } });
      }
      const u = result.rows[0];
      return { data: { id: u.id, email: u.email_normalized, role: u.role, status: u.status, emailVerified: !!u.email_verified_at, mfaEnabled: !!u.mfa_enabled_at } };
    } catch (error) {
      request.log.error({ err: error }, 'e2e user-status error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });
}
