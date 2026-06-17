/**
 * Private Investor API Routes
 *
 * Endpoints protected by Better Auth session + local authorization.
 * Replaces the legacy session-based investor routes when Better Auth is enabled.
 */
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
  }, async (request: FastifyRequest) => {
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
                (SELECT url FROM opportunity_media WHERE opportunity_id = o.id AND type = 'image' ORDER BY position LIMIT 1) AS primary_image_url
         FROM opportunities o
         JOIN project_user_access pua ON pua.opportunity_id = o.id
         WHERE pua.app_user_id = $1 AND pua.status = 'active'
         ORDER BY o.created_at DESC
         LIMIT 50`,
        [appUser.id],
      );
    }

    const projects = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: row.short_description,
      city: row.city,
      status: row.status,
      riskLevel: row.risk_level,
      targetReturnType: row.target_return_type,
      targetReturnBps: row.target_return_bps,
      targetAmountCents: row.target_amount_cents ? parseInt(String(row.target_amount_cents), 10) : 0,
      committedAmountCents: row.committed_amount_cents ? parseInt(String(row.committed_amount_cents), 10) : 0,
      estimatedTermMonths: row.estimated_term_months,
      primaryImageUrl: row.primary_image_url || null,
    }));

    return { data: projects };
  });

  // ── GET /api/investor/projects/:id ──
  app.get('/api/investor/projects/:id', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT o.*,
              (SELECT json_agg(json_build_object('id', m.id, 'type', m.type, 'url', m.url, 'alt_text', m.alt_text, 'position', m.position))
               FROM opportunity_media m WHERE m.opportunity_id = o.id ORDER BY m.position) AS media,
              (SELECT json_agg(json_build_object('id', h.id, 'label', h.label, 'value', h.value, 'position', h.position))
               FROM opportunity_highlights h WHERE h.opportunity_id = o.id ORDER BY h.position) AS highlights,
              (SELECT json_agg(json_build_object('id', r.id, 'title', r.title, 'description', r.description, 'position', r.position))
               FROM opportunity_risks r WHERE r.opportunity_id = o.id ORDER BY r.position) AS risks,
              (SELECT json_agg(json_build_object('id', ml.id, 'title', ml.title, 'description', ml.description, 'planned_date', ml.planned_date, 'completed_at', ml.completed_at, 'position', ml.position))
               FROM opportunity_milestones ml WHERE ml.opportunity_id = o.id ORDER BY ml.position) AS milestones
       FROM opportunities o
       WHERE o.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send(publicError('not_found', 'Proyecto no encontrado.'));
    }

    const row = result.rows[0];
    return {
      data: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        shortDescription: row.short_description,
        description: row.description,
        city: row.city,
        countryCode: row.country_code,
        district: row.district,
        assetType: row.asset_type,
        strategy: row.strategy,
        status: row.status,
        riskLevel: row.risk_level,
        targetReturnType: row.target_return_type,
        targetReturnBps: row.target_return_bps,
        targetAmountCents: row.target_amount_cents ? parseInt(String(row.target_amount_cents), 10) : null,
        committedAmountCents: row.committed_amount_cents ? parseInt(String(row.committed_amount_cents), 10) : null,
        minimumInvestmentCents: row.minimum_investment_cents ? parseInt(String(row.minimum_investment_cents), 10) : null,
        estimatedTermMonths: row.estimated_term_months,
        closingDate: row.closing_date,
        media: row.media || [],
        highlights: row.highlights || [],
        risks: row.risks || [],
        milestones: row.milestones || [],
      },
    };
  });

  // ── GET /api/investor/projects/:id/documents ──
  app.get('/api/investor/projects/:id/documents', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      `SELECT id, title, type, status, version, mime_type, byte_size, created_at, updated_at
       FROM documents
       WHERE owner_type = 'opportunity' AND owner_id = $1 AND visibility = 'private'
       ORDER BY created_at DESC`,
      [id],
    );

    const documents = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      version: row.version,
      mimeType: row.mime_type,
      byteSize: row.byte_size ? parseInt(String(row.byte_size), 10) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { data: documents };
  });

  // ── GET /api/investor/profile ──
  app.get('/api/investor/profile', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    // Get investor profile if exists
    const profileResult = await pool.query(
      `SELECT ip.* FROM investor_profiles ip WHERE ip.user_id = $1`,
      [appUser.id], // Note: this maps to the old users.id; needs adaptation for app_users
    );

    // Fallback: get profile via any linked legacy user
    // For now, return basic app_user data
    return {
      data: {
        id: appUser.id,
        displayName: appUser.displayName,
        email: appUser.emailNormalized,
        role: appUser.role,
        status: appUser.status,
        emailVerified: !!appUser.emailVerifiedAt,
        mfaEnabled: !!appUser.mfaEnabledAt,
        activatedAt: appUser.activatedAt,
        investorProfile: profileResult.rows.length > 0 ? {
          status: profileResult.rows[0].status,
          kycStatus: profileResult.rows[0].kyc_status,
          accredited: profileResult.rows[0].accredited,
        } : null,
      },
    };
  });
}
