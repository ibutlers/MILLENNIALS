/**
 * Invitation API Routes
 *
 * Endpoints for staff/admin to manage access invitations.
 * All require authentication + staff or admin role.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { InvitationRepository } from './invitations.js';
import { requireBetterAuthSession, requireActiveAppUser, requireRole } from './middleware.js';
import type { AuthEmailProvider } from './email-provider.js';

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

export interface InvitationRoutesOptions {
  pool: Pool;
  emailProvider: AuthEmailProvider;
}

export function registerInvitationRoutes(
  app: FastifyInstance,
  options: InvitationRoutesOptions,
): void {
  const { pool, emailProvider } = options;
  const repo = new InvitationRepository(pool);

  // ── POST /api/v1/invitations — create invitation ──
  app.post('/api/v1/invitations', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('staff', 'admin'),
    ],
   
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email : null;
    const coinvestLeadReference = typeof body.coinvestLeadReference === 'string' ? body.coinvestLeadReference : null;
    const intendedRole = typeof body.intendedRole === 'string' ? body.intendedRole : 'investor';

    if (!email || !email.includes('@')) {
      return reply.status(400).send(publicError('invalid_request', 'Email requerido.'));
    }

    const emailNormalized = email.toLowerCase().trim();

    // Validate role
    if (!['investor', 'staff', 'admin'].includes(intendedRole)) {
      return reply.status(400).send(publicError('invalid_request', 'Rol no válido.'));
    }

    try {
      // Find coinvest lead if reference provided
      let coinvestLeadId: string | null = null;
      if (coinvestLeadReference) {
        const leadResult = await pool.query(
          `SELECT id FROM leads WHERE public_reference = $1`,
          [coinvestLeadReference],
        );
        if (leadResult.rows.length > 0) {
          coinvestLeadId = leadResult.rows[0].id as string;
        }
      }

      const appUser = (request as any).appUser;

      const { invitation } = await repo.create({
        emailNormalized,
        coinvestLeadId: coinvestLeadId || undefined,
        intendedRole: intendedRole as 'investor' | 'staff' | 'admin',
        createdBy: appUser?.id,
      });

      // Send invitation email
      try {
        await emailProvider.sendInvitation(emailNormalized, invitation.publicReference);
      } catch {
        request.log.warn({ ref: invitation.publicReference }, 'failed to send invitation email');
      }

      // DO NOT return the token — it should be sent via email only
      return reply.status(201).send({
        data: {
          publicReference: invitation.publicReference,
          email: emailNormalized,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (err) {
      const code = (err as any).code;
      const statusCode = (err as any).statusCode || 500;

      if (code === 'duplicate_invitation') {
        return reply.status(409).send(publicError('conflict', 'Ya existe una invitación activa para este email.'));
      }
      if (code === 'active_user_exists') {
        return reply.status(409).send(publicError('conflict', 'Ya existe un usuario activo con este email.'));
      }

      request.log.error({ err }, 'invitation creation failed');
      return reply.status(statusCode).send(publicError('internal_error', 'No se ha podido crear la invitación.'));
    }
  });

  // ── GET /api/v1/invitations — list invitations ──
  app.get('/api/v1/invitations', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('staff', 'admin'),
    ],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const result = await repo.list({
      status: query.status,
      email: query.email,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    // Redact token hashes from response
    const safe = result.invitations.map((inv) => ({
      publicReference: inv.publicReference,
      emailNormalized: inv.emailNormalized,
      intendedRole: inv.intendedRole,
      status: inv.status,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
      resendCount: inv.resendCount,
      lastSentAt: inv.lastSentAt,
    }));

    return { data: safe, meta: { total: result.total } };
  });

  // ── POST /api/v1/invitations/validate — validate an invitation token (public, no auth needed) ──
  app.post('/api/v1/invitations/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : null;
    const email = typeof body.email === 'string' ? body.email : null;

    if (!token || !email) {
      return reply.status(400).send(publicError('invalid_request', 'Token y email requeridos.'));
    }

    const result = await repo.validateToken(token, email);

    if (!result.valid) {
      return reply.status(400).send(publicError(`invitation_${result.reason}`, 'La invitación no es válida o ha expirado.'));
    }

    return {
      data: {
        valid: true,
        email: result.invitation.emailNormalized,
        intendedRole: result.invitation.intendedRole,
      },
    };
  });

  // ── POST /api/v1/invitations/:reference/revoke — revoke an invitation ──
  app.post('/api/v1/invitations/:reference/revoke', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('staff', 'admin'),
    ],
   
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { reference } = request.params as { reference: string };
    const body = request.body as Record<string, unknown> || {};
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    const appUser = (request as any).appUser;

    const invitation = await repo.findByReference(reference);
    if (!invitation) {
      return reply.status(404).send(publicError('not_found', 'Invitación no encontrada.'));
    }

    const revoked = await repo.revoke(invitation.id, appUser.id, reason);
    if (!revoked) {
      return reply.status(409).send(publicError('conflict', 'La invitación ya no está activa.'));
    }

    return { data: { publicReference: revoked.publicReference, status: revoked.status } };
  });
}
