/**
 * Private Investor API Routes
 *
 * Endpoints protected by Better Auth session + local authorization.
 * Replaces the legacy session-based investor routes when Better Auth is enabled.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import {
  requireBetterAuthSession,
  requireActiveAppUser,
  requireVerifiedEmail,
  requireMfa,
  requireProjectAccess,
} from '../auth/middleware.js';
import type { ProviderSet } from '../providers/index.js';

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

export interface PrivateInvestorRoutesOptions {
  pool: Pool;
  providers?: ProviderSet;
}

export function registerPrivateInvestorRoutes(
  app: FastifyInstance,
  options: PrivateInvestorRoutesOptions,
): void {
  const { pool } = options;

  // ── Auth chain shared by all private routes ──
  const authChain = [
    requireBetterAuthSession(),
    requireActiveAppUser(pool),
    requireVerifiedEmail(),
    requireMfa(),
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

  // ── GET /api/investor/projects ──
  app.get('/api/investor/projects', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    // Staff/admin see all projects; investors see only granted ones
    let result;
    if (appUser.role === 'staff' || appUser.role === 'admin') {
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
      `SELECT id, title, file_type, file_size, created_at
       FROM private_documents
       WHERE opportunity_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [id],
    );

    return { data: result.rows };
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
