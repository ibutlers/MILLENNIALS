/**
 * Private Investor API Routes
 *
 * Endpoints protected by Better Auth session + local authorization.
 * Replaces the legacy session-based investor routes when Better Auth is enabled.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';
import {
  requireBetterAuthSession,
  requireActiveAppUser,
  requireVerifiedEmail,
  requireMfa,
  requireProjectAccess,
} from '../auth/middleware.js';
import type { ProviderSet } from '../providers/index.js';
import { createInvestmentRequest, reportInvestmentTransfer } from './investment-requests.js';
import { z } from 'zod';

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

const investmentRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('EUR'),
  message: z.string().max(2000).optional().nullable(),
});

const transferReportSchema = z.object({
  transferReference: z.string().min(2).max(200),
  transferNotes: z.string().max(2000).optional().nullable(),
});

export interface PrivateInvestorRoutesOptions {
  pool: Pool;
  config?: Pick<AppConfig, 'betterAuthRequire2FA'>;
  providers?: ProviderSet;
}

export function registerPrivateInvestorRoutes(
  app: FastifyInstance,
  options: PrivateInvestorRoutesOptions,
): void {
  const { pool } = options;
  const storageProvider = options.providers?.storage;

  // ── Auth chain shared by all private routes ──
  const authChain = [
    requireBetterAuthSession(),
    requireActiveAppUser(pool),
    requireVerifiedEmail(),
    requireMfa(options.config),
  ];

  // ── GET /api/investor/dashboard ──
  app.get('/api/investor/dashboard', {
    preHandler: authChain,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const appUser = (request as any).appUser;

      // Count user's active project accesses
      const accessResult = await pool.query(
        `SELECT count(*)::int AS count FROM project_user_access
         WHERE app_user_id = $1 AND status = 'active'`,
        [appUser.id],
      );

      return {
        data: {
          user: {
            id: appUser.id,
            displayName: appUser.displayName,
            email: appUser.emailNormalized,
            role: appUser.role,
            status: appUser.status,
            emailVerified: !!appUser.emailVerifiedAt,
            mfaEnabled: !!appUser.mfaEnabledAt,
          },
          summary: {
            activeProjects: accessResult.rows[0].count,
          },
        },
      };
    } catch (err) {
      request.log.error({ err, requestId: (request as any).id }, 'dashboard handler error');
      return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal error' } });
    }
  });

  // ── GET /api/investor/documents ──
  app.get('/api/investor/documents', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    const selectDocuments = `SELECT d.id,
              d.title,
              d.type,
              d.status,
              d.byte_size,
              d.mime_type,
              d.created_at,
              o.id::text AS project_id,
              o.slug AS project_slug,
              o.title AS project_title
       FROM documents d
       JOIN opportunities o ON o.id = d.owner_id`;

    const where = `WHERE d.owner_type = 'opportunity'
         AND d.status = 'active'
         AND d.visibility = 'private'`;

    const result = appUser.role === 'staff' || appUser.role === 'operator' || appUser.role === 'admin'
      ? await pool.query(`${selectDocuments}
       ${where}
       ORDER BY d.created_at DESC
       LIMIT 100`)
      : await pool.query(`${selectDocuments}
       JOIN project_user_access pua ON pua.opportunity_id = o.id
       ${where}
         AND pua.app_user_id = $1
         AND pua.status = 'active'
       ORDER BY d.created_at DESC
       LIMIT 100`, [appUser.id]);

    return { data: result.rows };
  });

  // ── GET /api/investor/projects ──
  app.get('/api/investor/projects', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    // Staff/admin see all projects; investors see only granted ones
    let result;
    if (appUser.role === 'staff' || appUser.role === 'operator' || appUser.role === 'admin') {
      result = await pool.query(
        `SELECT o.id, o.slug, o.title, o.short_description, o.city, o.status, o.risk_level,
                o.target_return_type, o.target_return_bps, o.target_amount_cents,
                o.committed_amount_cents, o.estimated_term_months,
                0::bigint AS investor_committed_amount_cents,
                o.currency AS investor_currency,
                (SELECT url FROM opportunity_media WHERE opportunity_id = o.id AND type = 'image' ORDER BY position LIMIT 1) AS primary_image_url
         FROM opportunities o
         ORDER BY o.created_at DESC
         LIMIT 50`,
      );
    } else {
      result = await pool.query(
        `SELECT o.id, o.slug, o.title, o.short_description, o.city, o.status, o.risk_level,
                o.target_return_type, o.target_return_bps, o.target_amount_cents,
                o.committed_amount_cents, o.estimated_term_months,
                pua.committed_amount_cents AS investor_committed_amount_cents,
                pua.currency AS investor_currency,
                pua.notes AS investor_notes,
                (SELECT url FROM opportunity_media WHERE opportunity_id = o.id AND type = 'image' ORDER BY position LIMIT 1) AS primary_image_url
         FROM opportunities o
         JOIN project_user_access pua ON pua.opportunity_id = o.id
         WHERE pua.app_user_id = $1 AND pua.status = 'active'
         ORDER BY o.created_at DESC
         LIMIT 50`,
        [appUser.id],
      );
    }

    return { data: result.rows };
  });

  // ── GET /api/investor/investment-requests ──
  app.get('/api/investor/investment-requests', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;
    const { rows } = await pool.query(
      `SELECT ir.*, o.slug, o.title, o.city
       FROM investment_requests ir
       JOIN opportunities o ON o.id = ir.opportunity_id
       WHERE ir.app_user_id = $1
       ORDER BY ir.created_at DESC
       LIMIT 100`,
      [appUser.id],
    );
    return { data: rows };
  });

  // ── POST /api/investor/projects/:id/investment-requests ──
  app.post('/api/investor/projects/:id/investment-requests', {
    preHandler: authChain,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const appUser = (request as any).appUser;
    const { id } = request.params as { id: string };
    const body = investmentRequestSchema.parse(request.body);
    try {
      const created = await createInvestmentRequest(pool, {
        appUserId: appUser.id,
        opportunityIdOrSlug: id,
        amountCents: body.amountCents,
        currency: body.currency,
        message: body.message,
      });
      return reply.status(201).send({ data: created });
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      if (statusCode >= 500) request.log.error({ err, project: id }, 'investment request creation failed');
      return reply.status(statusCode).send(publicError((err as any).code || 'investment_request_failed', (err as Error).message || 'No se ha podido crear la solicitud.'));
    }
  });

  // ── POST /api/investor/investment-requests/:reference/transfer ──
  app.post('/api/investor/investment-requests/:reference/transfer', {
    preHandler: authChain,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const appUser = (request as any).appUser;
    const { reference } = request.params as { reference: string };
    const body = transferReportSchema.parse(request.body);
    try {
      const updated = await reportInvestmentTransfer(pool, {
        reference,
        appUserId: appUser.id,
        transferReference: body.transferReference,
        transferNotes: body.transferNotes,
      });
      return { data: updated };
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      if (statusCode >= 500) request.log.error({ err, reference }, 'investment transfer report failed');
      return reply.status(statusCode).send(publicError((err as any).code || 'transfer_report_failed', (err as Error).message || 'No se ha podido registrar la transferencia.'));
    }
  });

  // ── GET /api/investor/projects/:id ──
  app.get('/api/investor/projects/:id', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const appUser = (request as any).appUser;
    const result = await pool.query(
      `SELECT o.id, o.slug, o.title, o.short_description, o.description, o.city, o.status, o.risk_level,
              o.target_return_type, o.target_return_bps, o.target_amount_cents,
              o.committed_amount_cents, o.estimated_term_months, o.created_at, o.updated_at,
              pua.committed_amount_cents AS investor_committed_amount_cents,
              pua.currency AS investor_currency,
              pua.notes AS investor_notes
       FROM opportunities o
       LEFT JOIN project_user_access pua ON pua.opportunity_id = o.id AND pua.app_user_id = $2 AND pua.status = 'active'
       WHERE o.id::text = $1 OR o.slug = $1`,
      [id, appUser.id],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send(publicError('not_found', 'Proyecto no encontrado.'));
    }

    return { data: result.rows[0] };
  });

  // ── GET /api/investor/projects/:id/documents ──
  app.get('/api/investor/projects/:id/documents', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT d.id,
              d.title,
              d.type,
              d.status,
              d.byte_size,
              d.mime_type,
              d.created_at,
              o.id::text AS project_id,
              o.slug AS project_slug,
              o.title AS project_title
       FROM documents d
       JOIN opportunities o ON o.id = d.owner_id
       WHERE d.owner_type = 'opportunity'
         AND d.status = 'active'
         AND d.visibility = 'private'
         AND (o.id::text = $1 OR o.slug = $1)
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [id],
    );

    return { data: result.rows };
  });

  // ── GET /api/investor/projects/:id/documents/:documentId/download ──
  app.get('/api/investor/projects/:id/documents/:documentId/download', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, documentId } = request.params as { id: string; documentId: string };

    const { rows: [document] } = await pool.query<{
      id: string;
      storage_ref: string | null;
      title: string;
    }>(
      `SELECT d.id::text AS id,
              d.storage_ref,
              d.title
       FROM documents d
       JOIN opportunities o ON o.id = d.owner_id
       WHERE d.owner_type = 'opportunity'
         AND d.status = 'active'
         AND d.visibility = 'private'
         AND d.id::text = $2
         AND (o.id::text = $1 OR o.slug = $1)
       LIMIT 1`,
      [id, documentId],
    );

    if (!document) {
      return reply.status(404).send(publicError('document_not_found', 'Documento no encontrado.'));
    }
    if (!document.storage_ref) {
      return reply.status(404).send(publicError('document_unavailable', 'El documento todavía no tiene fichero descargable.'));
    }
    if (!storageProvider) {
      return reply.status(503).send(publicError('provider_not_configured', 'El almacenamiento documental no está configurado.'));
    }

    try {
      const url = await storageProvider.getSecureUrl(document.storage_ref, 300);
      return reply.redirect(url);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode || 503;
      const code = (err as { code?: string }).code || 'provider_not_configured';
      return reply.status(statusCode).send(publicError(code, 'El almacenamiento documental no está configurado.'));
    }
  });

  // ── GET /api/investor/profile ──
  app.get('/api/investor/profile', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    return {
      data: {
        id: appUser.id,
        displayName: appUser.displayName,
        email: appUser.emailNormalized,
        role: appUser.role,
        status: appUser.status,
        emailVerified: !!appUser.emailVerifiedAt,
        mfaEnabled: !!appUser.mfaEnabledAt,
        createdAt: appUser.createdAt,
      },
    };
  });

  // ── GET /api/auth/me ──
  app.get('/api/auth/me', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    // Count visible projects
    const projResult = await pool.query(
      `SELECT count(*)::int AS count FROM project_user_access
       WHERE app_user_id = $1 AND status = 'active'`,
      [appUser.id],
    );

    return {
      data: {
        id: appUser.id,
        displayName: appUser.displayName,
        email: appUser.emailNormalized,
        role: appUser.role,
        status: appUser.status,
        emailVerified: !!appUser.emailVerifiedAt,
        mfaEnabled: !!appUser.mfaEnabledAt,
        permissions: {
          canAccessInvestorArea: appUser.status === 'active',
          visibleProjects: projResult.rows[0].count,
        },
        summary: {
          activeProjects: projResult.rows[0].count,
        },
      },
    };
  });
}
