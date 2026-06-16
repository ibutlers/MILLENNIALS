import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { getConfig, leadsCaptureAvailable, rejectInsecureAuth, type AppConfig } from './config.js';
import { getPool } from './db/pool.js';
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
import { createProviders, type ProviderSet } from './providers/index.js';

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
  if (!config.authEnabled) return; // Only enforce when auth is active

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

  // ── Plugins ──
  app.register(cookie);

  // ── CSRF / Origin check ──
  app.addHook('onRequest', async (request) => {
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

    // Fastify body-too-large → 413 (before route handler, never reaches createContact)
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

  // ── Auth routes ──
  registerAuthRoutes(app, {
    pool: pool as Pool,
    repo: authRepo,
    config,
    emailTransport,
  });

  registerAdminRoutes(app, {
    pool: pool as Pool,
    config,
  });

  registerInvestorRoutes(app, {
    pool: pool as Pool,
    authEnabled: config.authEnabled,
    providers,
  });

  return app;
}
