import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { getConfig, leadsCaptureAvailable, type AppConfig } from './config.js';
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

export type AppDependencies = {
  pool?: Pool;
  opportunities?: OpportunityRepository;
  leads?: Pick<LeadRepository, 'create'>;
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

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: dependencies.logger ?? true, bodyLimit: 16 * 1024 });
  const pool = dependencies.pool ?? (dependencies.opportunities && dependencies.leads ? undefined : getPool());
  const config = { ...getConfig(), ...dependencies.config };
  const opportunities = dependencies.opportunities ?? new OpportunityRepository(pool as Pool);
  const leads = dependencies.leads ?? new LeadRepository(pool as Pool);
  const leadRateLimiter = new OriginRateLimiter(config.leadsRateLimitMax, config.leadsRateLimitWindowMs);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const body = publicError('invalid_request', 'Los parámetros de la solicitud no son válidos.');
      request.log.warn({ errorId: body.error.id, issues: error.issues }, 'invalid request');
      return reply.status(400).send(errorResponseSchema.parse(body));
    }

    const body = publicError('internal_error', 'No hemos podido completar la solicitud en este momento.');
    request.log.error({ errorId: body.error.id, err: error }, 'unhandled api error');
    return reply.status(500).send(errorResponseSchema.parse(body));
  });

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

  app.get('/api/v1/lead-settings', async () => ({
    data: {
      enabled: leadsCaptureAvailable(config),
      privacyPolicyVersion: config.privacyPolicyVersion,
      controllerConfigured: Boolean(config.privacyControllerName),
      privacyContactConfigured: Boolean(config.privacyContactEmail)
    }
  }));

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

  return app;
}
