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
import { calculateFundingProgress, formatPublicReturnDisplay, serializeMoney } from '../opportunities/finance.js';
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

const projectReferenceSchema = z.string().regex(/^[a-z0-9-]{1,200}$/);
const documentIdSchema = z.string().uuid();

type ProviderHealth = { configured: boolean; status: string; message?: string };

type DocumentRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  byte_size: number | string | null;
  mime_type: string | null;
  created_at?: string;
  project_id?: string;
  project_slug?: string;
  project_title?: string;
  has_storage_ref?: boolean | null;
};

type InvestorOpportunityRow = {
  slug: string;
  title: string;
  short_description: string;
  city: string;
  country_code: string;
  district: string | null;
  asset_type: string;
  strategy: string;
  status: string;
  currency: string;
  project_total_amount_cents: string | number | null;
  minimum_investment_cents: string | number;
  estimated_term_months: number;
  target_return_bps: number | null;
  committed_amount_cents: string | number;
  target_amount_cents: string | number;
  primary_image_url: string | null;
  primary_image_alt_text: string | null;
  access_status: string | null;
  investor_committed_amount_cents: string | number | null;
  investor_currency: string | null;
  investor_notes: string | null;
  investment_requests: unknown;
};

type InvestmentRequestSummary = {
  public_reference: string;
  status: string;
  opportunity_slug?: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  transfer_reference: string | null;
};

async function isStorageConfigured(storageProvider: ProviderSet['storage'] | undefined): Promise<boolean> {
  if (!storageProvider) return false;
  try {
    const health = await storageProvider.health();
    return health.configured === true;
  } catch {
    return false;
  }
}

function publicKycStatus(status: string | undefined, configured: boolean): string {
  const allowed = new Set(['ok', 'available', 'not_configured', 'degraded', 'error']);
  if (status && allowed.has(status)) return status;
  return configured ? 'available' : 'not_configured';
}

async function getKycHealth(kycProvider: ProviderSet['kyc'] | undefined): Promise<ProviderHealth> {
  if (!kycProvider) return { configured: false, status: 'not_configured', message: 'Proveedor KYC no configurado.' };
  try {
    const health = await kycProvider.health();
    const configured = health.configured === true;
    return {
      configured,
      status: publicKycStatus(health.status, configured),
      message: configured ? 'Proveedor KYC disponible.' : 'Proveedor KYC no configurado.',
    };
  } catch {
    return { configured: false, status: 'error', message: 'No se ha podido comprobar el proveedor KYC.' };
  }
}

function serializeDocument(row: DocumentRow, storageConfigured: boolean) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    byte_size: row.byte_size,
    mime_type: row.mime_type,
    ...(row.created_at ? { created_at: row.created_at } : {}),
    ...(row.project_id ? { project_id: row.project_id } : {}),
    ...(row.project_slug ? { project_slug: row.project_slug } : {}),
    ...(row.project_title ? { project_title: row.project_title } : {}),
    download_available: Boolean(row.has_storage_ref) && storageConfigured,
  };
}

function parseInvestmentRequests(value: unknown): InvestmentRequestSummary[] {
  if (Array.isArray(value)) return value as InvestmentRequestSummary[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed as InvestmentRequestSummary[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serializeInvestorOpportunity(row: InvestorOpportunityRow) {
  const currency = row.currency;
  const committed = Number(row.investor_committed_amount_cents ?? 0);
  return {
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    city: row.city,
    countryCode: row.country_code,
    district: row.district,
    assetType: row.asset_type,
    strategy: row.strategy,
    status: row.status,
    currency,
    publicInvestmentAmount: serializeMoney(row.committed_amount_cents, currency),
    projectTotalAmount: serializeMoney(row.project_total_amount_cents ?? row.target_amount_cents, currency),
    minimumInvestment: serializeMoney(row.minimum_investment_cents, currency),
    estimatedTermMonths: row.estimated_term_months,
    publicReturnDisplay: formatPublicReturnDisplay(row.target_return_bps, row.estimated_term_months),
    fundingProgress: calculateFundingProgress(row.committed_amount_cents, row.target_amount_cents),
    primaryImage: row.primary_image_url
      ? { type: 'image', url: row.primary_image_url, altText: row.primary_image_alt_text ?? row.title, position: 0 }
      : null,
    investorAccess: row.access_status
      ? {
        status: row.access_status,
        committedAmount: serializeMoney(committed, row.investor_currency ?? currency),
        notes: row.investor_notes,
      }
      : null,
    investmentRequests: parseInvestmentRequests(row.investment_requests),
  };
}

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
  const kycProvider = options.providers?.kyc;

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

  // ── GET /api/investor/verification ──
  app.get('/api/investor/verification', {
    preHandler: authChain,
  }, async () => {
    const providerStatus = await getKycHealth(kycProvider);
    return {
      data: {
        status: providerStatus.configured ? 'not_started' : 'not_configured',
        providerStatus,
        canInitiate: false,
        disclaimer: providerStatus.configured
          ? 'El proveedor KYC está disponible, pero el inicio de sesión externa todavía no está habilitado para este perfil.'
          : 'El proveedor de verificación de identidad (KYC) no está configurado. No se simula un estado verificado.',
      },
    };
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
              NULLIF(d.storage_ref, '') IS NOT NULL AS has_storage_ref,
              o.id::text AS project_id,
              o.slug AS project_slug,
              o.title AS project_title
       FROM documents d
       JOIN opportunities o ON o.id = d.owner_id`;

    const where = `WHERE d.owner_type = 'opportunity'
         AND d.status = 'active'
         AND d.visibility = 'private'`;

    const result = appUser.role === 'operator' || appUser.role === 'admin'
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

    const storageConfigured = await isStorageConfigured(storageProvider);
    return { data: (result.rows as DocumentRow[]).map((row) => serializeDocument(row, storageConfigured)) };
  });

  // ── GET /api/investor/opportunities ──
  app.get('/api/investor/opportunities', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;
    const { rows } = await pool.query<InvestorOpportunityRow>(
      `SELECT o.slug,
              o.title,
              o.short_description,
              o.city,
              o.country_code,
              o.district,
              o.asset_type,
              o.strategy,
              o.status,
              o.currency,
              o.project_total_amount_cents,
              o.minimum_investment_cents,
              o.estimated_term_months,
              o.target_return_bps,
              o.committed_amount_cents,
              o.target_amount_cents,
              m.url AS primary_image_url,
              m.alt_text AS primary_image_alt_text,
              pua.status AS access_status,
              pua.committed_amount_cents AS investor_committed_amount_cents,
              pua.currency AS investor_currency,
              pua.notes AS investor_notes,
              COALESCE(ir.requests, '[]'::jsonb) AS investment_requests
       FROM opportunities o
       LEFT JOIN LATERAL (
         SELECT url, alt_text
         FROM opportunity_media
         WHERE opportunity_id = o.id AND type = 'image'
         ORDER BY position ASC
         LIMIT 1
       ) m ON true
       LEFT JOIN project_user_access pua ON pua.opportunity_id = o.id
         AND pua.app_user_id = $1
         AND pua.status = 'active'
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'public_reference', req.public_reference,
           'status', req.status,
           'opportunity_slug', o.slug,
           'requested_amount_cents', req.requested_amount_cents,
           'approved_amount_cents', req.approved_amount_cents,
           'transfer_reference', req.transfer_reference
         ) ORDER BY req.created_at DESC) AS requests
         FROM investment_requests req
         WHERE req.opportunity_id = o.id AND req.app_user_id = $1
       ) ir ON true
       WHERE o.visibility = 'public'
         AND o.editorial_status = 'published'
         AND o.published_at IS NOT NULL
       ORDER BY o.published_at DESC NULLS LAST, o.slug ASC
       LIMIT 50`,
      [appUser.id],
    );

    return { data: rows.map(serializeInvestorOpportunity) };
  });

  // ── GET /api/investor/projects ──
  app.get('/api/investor/projects', {
    preHandler: authChain,
  }, async (request: FastifyRequest) => {
    const appUser = (request as any).appUser;

    // Operator/admin see all projects; investors see only granted ones
    let result;
    if (appUser.role === 'operator' || appUser.role === 'admin') {
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
    const projectRef = projectReferenceSchema.safeParse(id);
    if (!projectRef.success) {
      return reply.status(400).send(publicError('invalid_project_reference', 'Referencia de proyecto no válida.'));
    }

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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const projectRef = projectReferenceSchema.safeParse(id);
    if (!projectRef.success) {
      return reply.status(400).send(publicError('invalid_project_reference', 'Referencia de proyecto no válida.'));
    }

    const result = await pool.query(
      `SELECT d.id,
              d.title,
              d.type,
              d.status,
              d.byte_size,
              d.mime_type,
              d.created_at,
              NULLIF(d.storage_ref, '') IS NOT NULL AS has_storage_ref,
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

    const storageConfigured = await isStorageConfigured(storageProvider);
    return { data: (result.rows as DocumentRow[]).map((row) => serializeDocument(row, storageConfigured)) };
  });

  // ── GET /api/investor/projects/:id/documents/:documentId/download ──
  app.get('/api/investor/projects/:id/documents/:documentId/download', {
    preHandler: [...authChain, requireProjectAccess(pool)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, documentId } = request.params as { id: string; documentId: string };
    const projectRef = projectReferenceSchema.safeParse(id);
    if (!projectRef.success) {
      return reply.status(400).send(publicError('invalid_project_reference', 'Referencia de proyecto no válida.'));
    }
    const parsedDocumentId = documentIdSchema.safeParse(documentId);
    if (!parsedDocumentId.success) {
      return reply.status(400).send(publicError('invalid_document_id', 'ID de documento no válido.'));
    }

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
      [id, parsedDocumentId.data],
    );

    if (!document) {
      return reply.status(404).send(publicError('document_not_found', 'Documento no encontrado.'));
    }
    if (!document.storage_ref) {
      return reply.status(404).send(publicError('document_unavailable', 'El documento todavía no tiene fichero descargable.'));
    }
    const storageConfigured = await isStorageConfigured(storageProvider);
    if (!storageConfigured || !storageProvider) {
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
