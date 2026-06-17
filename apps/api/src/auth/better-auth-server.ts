/**
 * Better Auth v1.6.19 — Server factory
 *
 * Creates a configured Better Auth server instance with:
 * - Email + password authentication
 * - TOTP two-factor authentication (mandatory)
 * - Organization plugin (single org: MILLENNIALS CONSTRUYEN)
 * - PostgreSQL adapter with schema isolation (auth.*)
 * - Sign-up protection via X-Invitation-Token header (hooks.before/after)
 *
 * Schema isolation: Better Auth stores its tables in the `auth` schema.
 * Business tables remain in `public`. The pg Pool passed here has
 * `search_path=auth,public` so bare table references resolve to auth.*.
 *
 * IMPORTANT: This server is only created when AUTH_MODE=better-auth.
 * In AUTH_MODE=disabled, no Better Auth instance exists and no cookies are emitted.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { betterAuth, APIError } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import type { AuthEmailProvider } from './email-provider.js';
import type { InvitationRepository } from './invitations.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createBetterAuthServer(
  pool: Pool,
  config: AppConfig,
  emailProvider: AuthEmailProvider,
  invitations?: InvitationRepository,
) {
  const baseURL = config.betterAuthUrl || config.appBaseUrl;

  const trustedOrigins = config.betterAuthTrustedOrigins.length > 0
    ? config.betterAuthTrustedOrigins
    : [baseURL];

  // ── Sign-up protection hooks ──────────────────────────────────────────
  // Invitation validation in before hook (no consumption)
  // Invitation consumption in after hook (atomic, after successful signup)
  const beforeHooks: any[] = [];
  const afterHooks: any[] = [];

  if (invitations) {
    // BEFORE: validate invitation without consuming it
    beforeHooks.push(async (ctx: any) => {
      if (ctx.path !== '/sign-up/email') return;

      // 1. Exige X-Invitation-Token header
      if (!ctx.headers || typeof ctx.headers.get !== 'function') {
        throw APIError.fromStatus('FORBIDDEN', {
          message: 'Se requiere un token de invitación válido para registrarse.',
        });
      }

      const rawToken = ctx.headers.get('x-invitation-token') as string | null;
      if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
        throw APIError.fromStatus('FORBIDDEN', {
          message: 'Se requiere un token de invitación válido para registrarse.',
        });
      }

      // 2. Normaliza email del body
      const email = (ctx.body?.email as string | undefined)?.toLowerCase().trim();
      if (!email || !email.includes('@')) {
        throw APIError.fromStatus('BAD_REQUEST', {
          message: 'El email proporcionado no es válido.',
        });
      }

      // 3. Valida invitación (sin consumir)
      const result = await invitations.validateToken(rawToken, email);
      if (!result.valid) {
        throw APIError.fromStatus('FORBIDDEN', {
          message: 'La invitación no es válida, ha expirado o ya ha sido utilizada.',
        });
      }

      // 4. Rechaza campos no permitidos enviados por cliente
      const forbiddenFields = ['role', 'status', 'userId', 'permissions', 'admin', 'staff'];
      for (const field of forbiddenFields) {
        if (ctx.body?.[field] !== undefined) {
          throw APIError.fromStatus('FORBIDDEN', {
            message: 'La solicitud contiene campos no permitidos.',
          });
        }
      }

      // No consume la invitación todavía — eso ocurre en after
    });

    // AFTER: consume invitation atomically after successful signup
    afterHooks.push(async (ctx: any) => {
      if (ctx.path !== '/sign-up/email') return;

      // Only run on success
      const responseStatus = (ctx as any).responseStatus ?? (ctx as any)._responseStatus;
      if (responseStatus && responseStatus >= 400) return;

      const rawToken = ctx.headers?.get?.('x-invitation-token') as string | undefined;
      const email = (ctx.body?.email as string | undefined)?.toLowerCase().trim();

      if (!rawToken || !email) return;

      const tokenHash = hashToken(rawToken);

      const pgClient = await pool.connect();
      try {
        await pgClient.query('BEGIN');

        const invResult = await pgClient.query(
          `UPDATE access_invitations
           SET status = 'accepted', accepted_at = now()
           WHERE email_normalized = $1
             AND token_hash = $2
             AND status = 'pending'
             AND expires_at > now()
           RETURNING id, public_reference`,
          [email, tokenHash],
        );

        if (invResult.rows.length === 0) {
          await pgClient.query('ROLLBACK');
          return;
        }

        const invitation = invResult.rows[0];
        const newUser = (ctx as any).context?.newUser;
        const betterAuthUserId = newUser?.id as string | undefined;

        if (betterAuthUserId) {
          await pgClient.query(
            `UPDATE access_invitations SET better_auth_user_id = $1 WHERE id = $2`,
            [betterAuthUserId, invitation.id],
          );

          await pgClient.query(
            `INSERT INTO app_users (better_auth_user_id, email_normalized, display_name, role, status)
             VALUES ($1, $2, $3, 'investor', 'pending_email')
             ON CONFLICT (better_auth_user_id) DO UPDATE
               SET email_normalized = EXCLUDED.email_normalized,
                   updated_at = now()`,
            [betterAuthUserId, email, newUser?.name || email],
          );

          await pgClient.query(
            `INSERT INTO auth_audit_events (action, resource_type, resource_id, result, metadata)
             VALUES ('invitation_accepted', 'access_invitation', $1, 'success', $2)`,
            [invitation.id, JSON.stringify({ reference: invitation.public_reference })],
          );
        }

        await pgClient.query('COMMIT');
      } catch (error) {
        await pgClient.query('ROLLBACK').catch(() => {});
        try {
          const logger = (ctx as any).context?.logger;
          if (logger?.error) {
            logger.error({ err: error }, 'invitation consumption failed');
          }
        } catch { /* silent */ }
      } finally {
        pgClient.release();
      }
    });
  }

  const hooksConfig = (beforeHooks.length > 0 || afterHooks.length > 0)
    ? {
        before: beforeHooks[0] as any,
        after: afterHooks[0] as any,
      }
    : undefined;

  return betterAuth({
    appName: 'MILLENNIALS CONSTRUYEN',

    // ── Request lifecycle hooks ──
    hooks: hooksConfig,

    // ── Email + Password ──
    emailAndPassword: {
      enabled: true,
      disableSignUp: false, // Protected by hooks.before
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: config.authPasswordMinLength,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await emailProvider.sendPasswordReset(user.email, url);
      },
    },

    // ── Email verification ──
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await emailProvider.sendVerification(user.email, url);
      },
      expiresIn: config.emailVerificationTtlSeconds,
      autoSignInAfterVerification: false,
    },

    // ── No social login ──
    socialProviders: {},

    // ── Plugins ──
    plugins: [
      twoFactor({
        issuer: 'MILLENNIALS CONSTRUYEN',
        skipVerificationOnEnable: false,
      }),
      organization({
        allowUserToCreateOrganization: false,
        allowUserToInviteMembers: false,
        allowUserToChangeMemberRole: false,
      }),
    ],

    // ── Database (pg Pool, runtime compatible) ──
    database: pool,

    // ── Field mappings (camelCase → snake_case for auth schema) ──
    user: {
      modelName: 'user',
      fields: {
        emailVerified: 'email_verified',
        twoFactorEnabled: 'two_factor_enabled',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },

    session: {
      expiresIn: config.authSessionExpiresHours * 60 * 60,
      updateAge: 15 * 60,
      cookieCache: { enabled: false },
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        userId: 'user_id',
        activeOrganizationId: 'active_organization_id',
      },
    },

    account: {
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },

    verification: {
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },

    // ── Rate limiting ──
    rateLimit: {
      enabled: true,
      window: Math.max(1, Math.ceil(config.authRateLimitWindowMs / 1000)),
      max: config.authRateLimitMax,
      storage: 'memory',
    },

    // ── Security & URLs ──
    trustedOrigins,
    baseURL,
    basePath: '/api/auth',
    secret: config.betterAuthSecret,

    // ── Advanced ──
    advanced: {
      cookiePrefix: config.betterAuthCookiePrefix,
      useSecureCookies: config.sessionCookieSecure,
    },
  });
}
