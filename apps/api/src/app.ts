import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { ZodError } from 'zod';
import { getConfig, isBetterAuthEnabled, leadsCaptureAvailable, rejectInsecureAuth, type AppConfig } from './config.js';
import { getPool, createAuthPool } from './db/pool.js';
import { OriginRateLimiter } from './leads/rate-limit.js';
import { LeadRepository } from './leads/repository.js';
import { leadCreatedResponseSchema, leadRequestSchema, normalizeLeadInput } from './leads/schemas.js';
import { OpportunityRepository } from './opportunities/repository.js';
import {
  errorResponseSchema,
  opportunityDetailResponseSchema,
  opportunityFiltersResponseSchema,
  opportunityListQuerySchema,
  opportunityListResponseSchema,
  slugParamsSchema
} from './opportunities/schemas.js';
import { AuthRepository } from './auth/repository.js';
import { ConsoleEmailTransport, type EmailTransport } from './auth/email.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerAdminRoutes } from './admin/routes.js';
import { registerInvestorRoutes } from './investor/routes.js';
import { registerPrivateInvestorRoutes } from './investor/private-routes.js';
import { createProviders, type ProviderSet } from './providers/index.js';
import { betterAuthPlugin, setBetterAuthServer, type InvitationValidator } from './auth/better-auth-plugin.js';
import { createBetterAuthServer } from './auth/better-auth-server.js';
import { createAuthEmailProvider } from './auth/email-provider.js';
import { InvitationRepository } from './auth/invitations.js';
import { registerInvitationRoutes } from './auth/invitation-routes.js';

export type AppDependencies = {
  pool?: Pool;
  opportunities?: OpportunityRepository;
  leads?: Pick<LeadRepository, 'create' | 'createContact'> & Partial<Pick<LeadRepository, 'createCoinvest'>>;
  auth?: {
    repo: AuthRepository;
    emailTransport: EmailTransport;
  };
  emailTransport?: EmailTransport;
  providers?: ProviderSet;
  config?: Partial<AppConfig>;
  logger?: boolean | object;
};

function errorId() {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

function validatePublicResponse<T>(result: { success: true; data: T } | { success: false }) {
  if (result.success) return result.data;
  throw new Error('Response contract validation failed');
}

const SAFE_ORIGINS = new Set<string>();

function isStateChanging(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

/** CSRF / Origin protection for state-changing requests */
function checkOrigin(request: { method: string; headers: Record<string, string | undefined> }, config: AppConfig): void {
  if (!isStateChanging(request.method)) return;
  if (!isBetterAuthEnabled(config)) return; // Only enforce when Better Auth is active

  const origin = request.headers['origin'];
  if (!origin) {
    // Allow same-origin requests that don't send Origin (form posts from same domain)
    return;
  }

  if (SAFE_ORIGINS.has(origin)) return;

  // Check if origin matches app base URL
  if (origin === config.appBaseUrl) {
    SAFE_ORIGINS.add(origin);
    return;
  }

  // Allow localhost origins in E2E/test environments (different ports = different origins)
  const isE2E = process.env.E2E_TEST_MODE === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e';
  if (isE2E && (origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://localhost:'))) {
    SAFE_ORIGINS.add(origin);
    return;
  }

  throw Object.assign(new Error('Invalid origin'), { statusCode: 403 });
}

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: dependencies.logger ?? true, bodyLimit: 16 * 1024 });
  const pool = dependencies.pool ?? (dependencies.opportunities && dependencies.leads ? undefined : getPool());
  const config = { ...getConfig(), ...dependencies.config };

  // Reject insecure auth config at startup
  rejectInsecureAuth(config);

  const opportunities = dependencies.opportunities ?? new OpportunityRepository(pool as Pool);
  const leads = dependencies.leads ?? new LeadRepository(pool as Pool);
  const leadRateLimiter = new OriginRateLimiter(config.leadsRateLimitMax, config.leadsRateLimitWindowMs);

  // Auth dependencies
  const authRepo = dependencies.auth?.repo ?? new AuthRepository(pool as Pool);
  const emailTransport = dependencies.emailTransport ?? dependencies.auth?.emailTransport ?? new ConsoleEmailTransport();

  // Providers (all disabled by default)
  const providers = dependencies.providers ?? createProviders();

  // ── Better Auth initialization ──
  let invitationValidator: InvitationValidator | undefined = undefined;
  // Single CaptureEmailProvider instance shared between Better Auth and invitation routes.
  // createAuthEmailProvider sets the global _captureProvider which E2E helpers read from.
  const authEmailProvider = createAuthEmailProvider(config.authEmailMode);
  if (isBetterAuthEnabled(config)) {
    const invitations = new InvitationRepository(pool as Pool);
    // Create a dedicated pool for Better Auth with search_path=auth,public
    // so bare table references (e.g. 'user') resolve to auth.*
    const authPool = createAuthPool();

    // Adapter for invitation validation + consumption at Fastify level
    // (Better Auth v1.6.19 hooks context does not reliably contain headers)
    invitationValidator = {
      validateToken: (token: string, email: string) => invitations.validateToken(token, email),

      /**
       * Finalizes invitation after Better Auth sign-up succeeds.
       * Single transaction — no nested pool connections to avoid lock contention.
       * If a previous sign-up created the app_user but failed to finalize,
       * the ON CONFLICT DO NOTHING makes this idempotent.
       */
      consumeAfterSignup: async (token: string, email: string, baUserId: string, userName?: string) => {
        const pgClient = await (pool as Pool).connect();
        try {
          await pgClient.query('BEGIN');
          const tokenHash = createHash('sha256').update(token).digest('hex');

          // 1. Lock+update the invitation row
          const invResult = await pgClient.query(
            `UPDATE access_invitations
             SET status = 'accepted', accepted_at = now(), better_auth_user_id = $1
             WHERE email_normalized = $2 AND token_hash = $3 AND status = 'pending' AND expires_at > now()
             RETURNING id, public_reference`,
            [baUserId, email, tokenHash],
          );

          if (invResult.rows.length > 0) {
            const inv = invResult.rows[0];

            // 2. Create app_user (idempotent)
            await pgClient.query(
              `INSERT INTO app_users (better_auth_user_id, email_normalized, display_name, role, status)
               VALUES ($1, $2, $3, 'investor', 'pending_email')
               ON CONFLICT (better_auth_user_id) DO NOTHING`,
              [baUserId, email, userName || email],
            );

            // 3. Fetch the app_user id
            const appUser = await pgClient.query(
              `SELECT id FROM app_users WHERE better_auth_user_id = $1`,
              [baUserId],
            );

            if (appUser.rows.length > 0) {
              const appUserId = appUser.rows[0].id;

              // 4. Link invitation → app_user (inline — no separate pool call)
              await pgClient.query(
                `UPDATE access_invitations SET app_user_id = $2 WHERE id = $1 AND app_user_id IS NULL`,
                [inv.id, appUserId],
              );

              // 5. Audit event (inline — same transaction)
              await pgClient.query(
                `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result)
                 VALUES ($1, 'invitation_accepted', $2, 'access_invitation', $3, 'success')`,
                [appUserId, appUserId, inv.id],
              );
            }
          }

          await pgClient.query('COMMIT');
        } catch {
          await pgClient.query('ROLLBACK').catch(() => {});
          throw new Error('Failed to finalize invitation after signup');
        } finally {
          pgClient.release();
        }
      },

      /**
       * Idempotent reconciliation: repairs state when a previous sign-up
       * created the Better Auth user but the local finalization failed.
       * Safe to call multiple times; never degrades existing state.
       */
      reconcileAfterSignup: async (email: string, baUserId: string) => {
        const pgClient = await (pool as Pool).connect();
        try {
          await pgClient.query('BEGIN');

          // Check existing app_user
          const existing = await pgClient.query(
            `SELECT id, status, email_normalized FROM app_users WHERE better_auth_user_id = $1`,
            [baUserId],
          );

          // Only reconcile if no existing app_user for this BA user
          if (existing.rows.length === 0) {
            // Find a pending invitation for this email
            const pendingInv = await pgClient.query(
              `SELECT id, public_reference FROM access_invitations
               WHERE email_normalized = $1 AND status = 'pending' AND expires_at > now()
               ORDER BY created_at ASC LIMIT 1`,
              [email],
            );

            if (pendingInv.rows.length > 0) {
              const inv = pendingInv.rows[0];

              // Create app_user
              await pgClient.query(
                `INSERT INTO app_users (better_auth_user_id, email_normalized, display_name, role, status)
                 VALUES ($1, $2, $3, 'investor', 'pending_email')
                 ON CONFLICT (better_auth_user_id) DO NOTHING`,
                [baUserId, email, email],
              );

              const appUser = await pgClient.query(
                `SELECT id FROM app_users WHERE better_auth_user_id = $1`,
                [baUserId],
              );

              if (appUser.rows.length > 0) {
                const appUserId = appUser.rows[0].id;

                // Consume invitation
                await pgClient.query(
                  `UPDATE access_invitations
                   SET status = 'accepted', accepted_at = now(), better_auth_user_id = $1, app_user_id = $2
                   WHERE id = $3 AND status = 'pending'`,
                  [baUserId, appUserId, inv.id],
                );

                // Audit
                await pgClient.query(
                  `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result)
                   VALUES ($1, 'invitation_accepted', $2, 'access_invitation', $3, 'success')`,
                  [appUserId, appUserId, inv.id],
                );

                app.log.info({ baUserId, email: email.slice(0, 3) + '***', invRef: inv.public_reference }, 'reconciled signup');
              }
            }
          }

          await pgClient.query('COMMIT');
        } catch (err) {
          await pgClient.query('ROLLBACK').catch(() => {});
          const e = err as Error & { code?: string };
          app.log.warn({ errMsg: e.message, errCode: e.code }, 'reconcileAfterSignup failed');
          throw err;
        } finally {
          pgClient.release();
        }
      },

      /**
       * Transitions app_users from pending_email to pending_mfa after
       * Better Auth email verification succeeds. Idempotent — safe to
       * call multiple times; never upgrades from suspended/revoked/active,
       * only from pending_email.
       */
      transitionAfterEmailVerification: async (baUserId: string) => {
        const pgClient = await (pool as Pool).connect();
        try {
          await pgClient.query('BEGIN');

          const result = await pgClient.query(
            `UPDATE app_users
             SET status = 'pending_mfa',
                 email_verified_at = COALESCE(email_verified_at, now()),
                 updated_at = now()
             WHERE better_auth_user_id = $1 AND status = 'pending_email'
             RETURNING id, email_normalized`,
            [baUserId],
          );

          if (result.rows.length > 0) {
            const user = result.rows[0];
            await pgClient.query(
              `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result)
               VALUES ($1, 'email_verified', $2, 'app_user', $3, 'success')`,
              [user.id, user.id, user.id],
            );
            const emailPrefix = String(user.email_normalized || '').slice(0, 3);
            app.log.info({ baUserId, email: emailPrefix + '***' }, 'post-verification: pending_email→pending_mfa');
          }

          await pgClient.query('COMMIT');
        } catch (err) {
          await pgClient.query('ROLLBACK').catch(() => {});
          const e = err as Error & { code?: string };
          app.log.warn({ errMsg: e.message, errCode: e.code }, 'transitionAfterEmailVerification failed');
          throw err;
        } finally {
          pgClient.release();
        }
      },
    };

    const validator = invitationValidator;
    try {
    const betterAuth = createBetterAuthServer(authPool, config, authEmailProvider, {
      afterEmailVerification: (betterAuthUserId: string) => validator.transitionAfterEmailVerification(betterAuthUserId),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBetterAuthServer(betterAuth as any);
    app.log.info('better-auth server initialized');
    } catch (error) {
    app.log.error({ err: error }, 'failed to initialize better-auth server');
    throw error;
    }
    }

    // ── Plugins ──
  app.register(cookie);

  // ── Better Auth plugin (mounts /api/auth/*) ──
  app.register(async (authApp) => {
    await betterAuthPlugin(authApp, config, pool as Pool, invitationValidator);
  });

  // ── CSRF / Origin check ──
  app.addHook('onRequest', async (request) => {
    // Skip origin check for Better Auth routes (Better Auth handles its own security)
    if (request.url.startsWith('/api/auth')) return;

    try {
      checkOrigin({ method: request.method, headers: request.headers as Record<string, string | undefined> }, config);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode || 403;
      throw Object.assign(new Error('Forbidden'), { statusCode });
    }
  });

  // ── Error handler ──
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const body = publicError('invalid_request', 'Los parámetros de la solicitud no son válidos.');
      request.log.warn({ errorId: body.error.id, issues: error.issues }, 'invalid request');
      return reply.status(400).send(errorResponseSchema.parse(body));
    }

    // Fastify body-too-large → 413
    if ((error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE' || (error as { statusCode?: number }).statusCode === 413) {
      const body = publicError('payload_too_large', 'El contenido de la solicitud es demasiado grande.');
      request.log.warn({ errorId: body.error.id }, 'payload too large');
      return reply.status(413).send(errorResponseSchema.parse(body));
    }

    const body = publicError('internal_error', 'No hemos podido completar la solicitud en este momento.');
    request.log.error({ errorId: body.error.id, err: error }, 'unhandled api error');
    return reply.status(500).send(errorResponseSchema.parse(body));
  });

  // ── Health ──
  app.get('/health', async () => 'ok');

  app.get('/api/health', async (_request, reply) => {
    try {
      const activePool = pool as Pool | undefined;
      if (!activePool) throw new Error('Postgres pool unavailable');
      await activePool.query('SELECT 1');
      return { status: 'ok', service: 'api', dependencies: { postgres: 'ok' } };
    } catch (error) {
      app.log.error({ err: error }, 'postgres dependency unavailable');
      return reply.status(503).send({ status: 'degraded', service: 'api', dependencies: { postgres: 'unavailable' } });
    }
  });

  app.get('/api/ready', async (_request, reply) => {
    try {
      const activePool = pool as Pool | undefined;
      if (!activePool) throw new Error('Postgres pool unavailable');
      await activePool.query('SELECT 1');
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ err: error }, 'readiness check failed');
      return reply.status(503).send({ status: 'not_ready' });
    }
  });

  // ── Auth status endpoint (public, informs frontend about auth availability) ──
  app.get('/api/auth/status', async () => ({
    mode: config.authMode,
    available: isBetterAuthEnabled(config),
  }));

  // ── Public config endpoint (minimal, no secrets exposed) ──
  app.get('/api/config/public', async () => ({
    authEnabled: isBetterAuthEnabled(config),
  }));

  // ── Opportunities ──
  app.get('/api/v1/opportunities', async (request) => {
    const query = opportunityListQuerySchema.parse(request.query);
    const response = await opportunities.list(query);
    return validatePublicResponse(opportunityListResponseSchema.safeParse(response));
  });

  app.get('/api/v1/opportunities/:slug', async (request, reply) => {
    const params = slugParamsSchema.parse(request.params);
    const response = await opportunities.findBySlug(params.slug);

    if (!response) {
      const body = publicError('not_found', 'No encontramos esta oportunidad pública.');
      return reply.status(404).send(errorResponseSchema.parse(body));
    }

    return validatePublicResponse(opportunityDetailResponseSchema.safeParse(response));
  });

  app.get('/api/v1/opportunity-filters', async () =>
    opportunityFiltersResponseSchema.parse({
      data: {
        statuses: ['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'commercializing', 'closed', 'cancelled'],
        riskLevels: ['low', 'medium', 'high', 'very_high'],
        targetReturnTypes: ['target_annual_return', 'target_total_return', 'target_irr', 'target_roi']
      }
    })
  );

  // ── Lead settings ──
  app.get('/api/v1/lead-settings', async () => ({
    data: {
      enabled: leadsCaptureAvailable(config),
      privacyPolicyVersion: config.privacyPolicyVersion,
      controllerConfigured: Boolean(config.privacyControllerName),
      privacyContactConfigured: Boolean(config.privacyContactEmail)
    }
  }));

  // ── Leads ──
  app.post('/api/v1/leads', async (request, reply) => {
    if (!leadsCaptureAvailable(config)) {
      const body = publicError('leads_disabled', 'La captación de solicitudes todavía no está habilitada.');
      return reply.status(503).send(errorResponseSchema.parse(body));
    }

    const origin = request.ip || 'unknown';
    const rate = leadRateLimiter.check(origin);
    if (!rate.allowed) {
      const body = publicError('rate_limited', 'Hemos recibido demasiadas solicitudes. Inténtalo más tarde.');
      return reply.status(429).send(errorResponseSchema.parse(body));
    }

    const parsed = leadRequestSchema.parse(request.body);
    const normalized = normalizeLeadInput(parsed);
    try {
      const created = await leads.create({ ...normalized, privacyPolicyVersion: config.privacyPolicyVersion });
      request.log.info({ leadReference: created.publicReference, leadKind: created.kind }, 'lead request created');
      return reply.status(201).send(leadCreatedResponseSchema.parse({
        data: {
          publicReference: created.publicReference,
          kind: created.kind,
          status: 'new',
          createdAt: created.createdAt,
          message: 'Solicitud recibida. Conserva esta referencia para futuras comunicaciones.'
        }
      }));
    } catch (error) {
      if ((error as Error).name === 'OpportunityNotFoundError') {
        const body = publicError('invalid_request', 'La oportunidad indicada no está disponible.');
        return reply.status(400).send(errorResponseSchema.parse(body));
      }
      throw error;
    }
  });

  // ── Contact form ──
  app.post('/api/contact', async (request, reply) => {
    const { contactRequestSchema, normalizeContactInput, contactCreatedResponseSchema } = await import('./leads/contact-schema.js');

    const origin = request.ip || 'unknown';
    const rate = leadRateLimiter.check(origin);
    if (!rate.allowed) {
      const body = publicError('rate_limited', 'Hemos recibido demasiadas solicitudes. Inténtalo más tarde.');
      return reply.status(429).send(errorResponseSchema.parse(body));
    }

    const parsed = contactRequestSchema.parse(request.body);
    const normalized = normalizeContactInput(parsed);
    try {
      const created = await leads.createContact(normalized);
      request.log.info({ contactReference: created.publicReference }, 'contact request created');
      return reply.status(201).send(contactCreatedResponseSchema.parse({
        data: {
          publicReference: created.publicReference,
          status: 'new',
          createdAt: created.createdAt,
          message: 'Mensaje enviado. Gracias por contactar con nosotros. Revisaremos tu consulta y te responderemos lo antes posible.'
        }
      }));
    } catch (error) {
      request.log.error({ err: error }, 'contact creation failed');
      const body = publicError('internal_error', 'No hemos podido enviar el mensaje. Revisa los datos e inténtalo de nuevo.');
      return reply.status(500).send(errorResponseSchema.parse(body));
    }
  });

  // ── Co-invest form ──
  app.post('/api/coinvest', async (request, reply) => {
    if (!leads.createCoinvest) {
      return reply.status(503).send(errorResponseSchema.parse(publicError('leads_disabled', 'La captación de solicitudes todavía no está habilitada.')));
    }
    const { coinvestRequestSchema, normalizeCoinvestInput, coinvestCreatedResponseSchema } = await import('./leads/co-invest.schema.js');

    const origin = request.ip || 'unknown';
    const rate = leadRateLimiter.check(origin);
    if (!rate.allowed) {
      const body = publicError('rate_limited', 'Hemos recibido demasiadas solicitudes. Inténtalo más tarde.');
      return reply.status(429).send(errorResponseSchema.parse(body));
    }

    const parsed = coinvestRequestSchema.parse(request.body);
    const normalized = normalizeCoinvestInput(parsed);
    try {
      const created = await leads.createCoinvest(normalized);
      request.log.info({ coinvestReference: created.publicReference }, 'coinvest request created');
      return reply.status(201).send(coinvestCreatedResponseSchema.parse({
        data: {
          publicReference: created.publicReference,
          status: 'new',
          createdAt: created.createdAt,
          message: 'Solicitud recibida. Revisaremos la información facilitada y contactaremos contigo si existe encaje.'
        }
      }));
    } catch (error) {
      request.log.error({ err: error }, 'coinvest creation failed');
      const body = publicError('internal_error', 'No hemos podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.');
      return reply.status(500).send(errorResponseSchema.parse(body));
    }
  });

  // ── Legacy Auth routes (only when Better Auth is disabled) ──
  if (!isBetterAuthEnabled(config)) {
    // Build legacy AuthConfig from AppConfig
    const legacyAuthConfig = {
      authEnabled: config.authEnabled, // Legacy auth enabled when Better Auth is disabled and authEnabled is true
      registrationEnabled: config.registrationEnabled,
      emailDeliveryEnabled: config.emailDeliveryEnabled,
      e2eTestMode: config.e2eTestMode,
      e2eInternalSecret: config.e2eInternalSecret,
      appBaseUrl: config.appBaseUrl,
      sessionCookieSecure: config.sessionCookieSecure,
      sessionTtlSeconds: config.sessionTtlSeconds,
      sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
      emailVerificationTtlSeconds: config.emailVerificationTtlSeconds,
      passwordResetTtlSeconds: config.passwordResetTtlSeconds,
      authRateLimitMax: config.authRateLimitMax,
      authRateLimitWindowMs: config.authRateLimitWindowMs,
    };
    registerAuthRoutes(app, {
      pool: pool as Pool,
      repo: authRepo,
      config: legacyAuthConfig,
      emailTransport,
    });
  }

  // ── Admin routes ──
  registerAdminRoutes(app, {
    pool: pool as Pool,
    config,
  });

  // ── Invitation routes (only when Better Auth is enabled) ──
  if (isBetterAuthEnabled(config)) {
    registerInvitationRoutes(app, {
      pool: pool as Pool,
      emailProvider: authEmailProvider,
    });
  }

  // ── E2E Auth helper routes (test-only, protected by x-e2e-secret) ──
  if (isBetterAuthEnabled(config) && config.e2eTestMode) {
    import('./auth/e2e-auth-helpers.js').then(({ registerE2EAuthHelpers }) => {
      registerE2EAuthHelpers(app, pool as Pool, config);
    }).catch((err) => {
      app.log.error({ err }, 'failed to register E2E auth helpers');
    });
  }

  // ── Investor routes (legacy, for AUTH_MODE=*** ──
  if (!isBetterAuthEnabled(config)) {
    registerInvestorRoutes(app, {
      pool: pool as Pool,
      authEnabled: false,
      providers,
    });
  }

  // ── Private investor routes (Better Auth enabled) ──
  if (isBetterAuthEnabled(config)) {
    registerPrivateInvestorRoutes(app, {
      pool: pool as Pool,
      providers,
    });
  }

  return app;
}
