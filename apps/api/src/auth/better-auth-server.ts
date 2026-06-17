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
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import type { AuthEmailProvider } from './email-provider.js';

export function createBetterAuthServer(
  pool: Pool,
  config: AppConfig,
  emailProvider: AuthEmailProvider,
) {
  const baseURL = config.betterAuthUrl || config.appBaseUrl;

  const trustedOrigins = config.betterAuthTrustedOrigins.length > 0
    ? config.betterAuthTrustedOrigins
    : [baseURL];

  // ── Sign-up protection is handled at the Fastify level in better-auth-plugin.ts ──
  // Better Auth v1.6.19 databaseHooks.user.create.before does not reliably
  // contain request headers. See betterAuthPlugin() for invitation validation.

  return betterAuth({
    appName: 'MILLENNIALS CONSTRUYEN',

    // ── Email + Password ──
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      requireEmailVerification: false, // TEMPORARY: diagnose sign-up 500
      autoSignIn: false,
      minPasswordLength: config.authPasswordMinLength,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await emailProvider.sendPasswordReset(user.email, url);
      },
    },

    // ── Email verification (temporarily disabled for diagnostics) ──
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
