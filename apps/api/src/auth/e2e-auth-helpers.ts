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

      // Find TOTP secret in auth."twoFactor"
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


  // ── POST /api/e2e/auth/ensure-projects ──
  app.post('/api/e2e/auth/ensure-projects', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const allowedProjects = [
        { slug: 'e2e-project-a', title: 'E2E Proyecto A' },
        { slug: 'e2e-project-b', title: 'E2E Proyecto B' },
      ];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const projects: Array<{ id: string; slug: string }> = [];
        for (const project of allowedProjects) {
          const result = await client.query<{ id: string; slug: string }>(
            `INSERT INTO opportunities (
               slug, title, short_description, description, city, country_code,
               asset_type, strategy, status, visibility, currency,
               target_amount_cents, committed_amount_cents, minimum_investment_cents,
               estimated_term_months, target_return_type, target_return_bps,
               risk_level, published_at, editorial_status
             ) VALUES (
               $1, $2, $3, $4, 'Vigo', 'ES',
               'residential', 'value_add', 'in_execution', 'private', 'EUR',
               100000000, 0, 500000, 18, 'target_total_return', 850,
               'medium', now(), 'published'
             )
             ON CONFLICT (slug) DO UPDATE SET
               title = EXCLUDED.title,
               short_description = EXCLUDED.short_description,
               visibility = 'private',
               updated_at = now()
             RETURNING id, slug`,
            [
              project.slug,
              project.title,
              `${project.title} privado para pruebas E2E`,
              `${project.title} creado de forma idempotente en entorno E2E`,
            ],
          );
          projects.push(result.rows[0]);
        }
        await client.query('COMMIT');
        return { data: { projects } };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      request.log.error({ err: error }, 'e2e ensure-projects error');
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

  // ── POST /api/e2e/auth/mark-active-without-mfa ──
  // Simulates legacy production users that became active while 2FA was optional.
  app.post('/api/e2e/auth/mark-active-without-mfa', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!safeSecretMatches(request.headers['x-e2e-secret'], secret)) {
      return reply.status(404).send(e2eNotFound());
    }
    try {
      const { email } = request.body as { email?: string };
      if (!email) return reply.status(400).send({ error: { code: 'bad_request', message: 'email required' } });
      const normalized = email.toLowerCase().trim();
      const userResult = await pool.query<{ id: string }>(
        `SELECT id FROM auth."user" WHERE lower(email) = $1`,
        [normalized],
      );
      if (userResult.rows.length === 0) {
        return reply.status(404).send({ error: { code: 'not_found', message: 'User not found' } });
      }
      const betterAuthUserId = userResult.rows[0].id;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const appResult = await client.query<{ id: string; status: string }>(
          `UPDATE app_users
           SET status = 'active',
               email_verified_at = COALESCE(email_verified_at, now()),
               activated_at = COALESCE(activated_at, now()),
               mfa_enabled_at = NULL,
               updated_at = now()
           WHERE email_normalized = $1 AND better_auth_user_id = $2
           RETURNING id, status`,
          [normalized, betterAuthUserId],
        );
        if (appResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: { code: 'not_found', message: 'App user not found' } });
        }
        await client.query(`UPDATE auth."user" SET "twoFactorEnabled" = false, updated_at = now() WHERE id = $1`, [betterAuthUserId]);
        await client.query(`DELETE FROM auth."twoFactor" WHERE "userId" = $1`, [betterAuthUserId]);
        await client.query('COMMIT');
        return { data: { email: normalized, status: appResult.rows[0].status, mfaEnabled: false } };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      request.log.error({ err: error }, 'e2e mark-active-without-mfa error');
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
