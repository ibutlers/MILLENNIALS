import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { getPool } from './db/pool.js';
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
  logger?: boolean;
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
  const app = Fastify({ logger: dependencies.logger ?? true });
  const pool = dependencies.pool ?? getPool();
  const opportunities = dependencies.opportunities ?? new OpportunityRepository(pool);

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
      await pool.query('SELECT 1');
      return { status: 'ok', service: 'api', dependencies: { postgres: 'ok' } };
    } catch (error) {
      app.log.error({ err: error }, 'postgres dependency unavailable');
      return reply.status(503).send({ status: 'degraded', service: 'api', dependencies: { postgres: 'unavailable' } });
    }
  });

  app.get('/api/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
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

  return app;
}
