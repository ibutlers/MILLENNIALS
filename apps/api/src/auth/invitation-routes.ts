/**
 * Invitation API Routes
 *
 * Endpoints for operator/admin to manage access invitations.
 * Legacy staff rows are normalised by auth middleware.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { InvitationRepository } from './invitations.js';
import { requireBetterAuthSession, requireActiveAppUser, requireRole } from './middleware.js';
import type { AuthEmailProvider } from './email-provider.js';
import { isAcceptedAppUserRole, toDatabaseAppUserRole } from './roles.js';

type AppError = Error & { code?: string; statusCode?: number };

function asAppError(error: unknown): AppError {
  return error instanceof Error ? error as AppError : new Error('unknown_error');
}

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

  // ---------- POST /api/v1/invitations ----------
  app.post('/api/v1/invitations', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('operator', 'admin'),
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

    if (!isAcceptedAppUserRole(intendedRole) && intendedRole !== 'staff') {
      return reply.status(400).send(publicError('invalid_request', 'Rol no valido.'));
    }

    try {
      let coinvestLeadId: string | null = null;
      if (coinvestLeadReference) {
        const leadResult = await pool.query(
          'SELECT id FROM leads WHERE public_reference = $1',
          [coinvestLeadReference],
        );
        if (leadResult.rows.length > 0) {
          coinvestLeadId = leadResult.rows[0].id as string;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appUser = (request as any).appUser;

      const { invitation, token } = await repo.create({
        emailNormalized,
        coinvestLeadId: coinvestLeadId || undefined,
        intendedRole: toDatabaseAppUserRole(intendedRole),
        createdBy: appUser?.id,
      });

      try {
        await emailProvider.sendInvitation(emailNormalized, '/acceso/activar#token=' + token);
      } catch {
        request.log.warn({ ref: invitation.publicReference }, 'failed to send invitation email');
      }

      return reply.status(201).send({
        data: {
          publicReference: invitation.publicReference,
          email: emailNormalized,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (err) {
      const appError = asAppError(err);
      const code = appError.code;
      const statusCode = appError.statusCode || 500;

      if (code === 'duplicate_invitation') {
        return reply.status(409).send(publicError('conflict', 'Ya existe una invitacion activa para este email.'));
      }
      if (code === 'active_user_exists') {
        return reply.status(409).send(publicError('conflict', 'Ya existe un usuario activo con este email.'));
      }

      request.log.error({ err }, 'invitation creation failed');
      return reply.status(statusCode).send(publicError('internal_error', 'No se ha podido crear la invitacion.'));
    }
  });

  // ---------- GET /api/v1/invitations ----------
  app.get('/api/v1/invitations', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('operator', 'admin'),
    ],
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const result = await repo.list({
      status: query.status,
      email: query.email,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

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

  // ---------- POST /api/v1/invitations/validate ----------
  app.post('/api/v1/invitations/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token : null;
    const email = typeof body.email === 'string' ? body.email : null;

    if (!token) {
      return reply.status(400).send(publicError('invalid_request', 'Token requerido.'));
    }

    const result = email ? await repo.validateToken(token, email) : await repo.validateTokenForActivation(token);

    if (!result.valid) {
      return reply.status(400).send(publicError('invitation_' + result.reason, 'La invitacion no es valida o ha expirado.'));
    }

    return {
      data: {
        valid: true,
        email: result.invitation.emailNormalized,
        intendedRole: result.invitation.intendedRole,
      },
    };
  });

  // ---------- POST /api/v1/invitations/:reference/revoke ----------
  app.post('/api/v1/invitations/:reference/revoke', {
    preHandler: [
      requireBetterAuthSession(),
      requireActiveAppUser(pool),
      requireRole('operator', 'admin'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { reference } = request.params as { reference: string };
    const body = request.body as Record<string, unknown> || {};
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appUser = (request as any).appUser;

    const invitation = await repo.findByReference(reference);
    if (!invitation) {
      return reply.status(404).send(publicError('not_found', 'Invitacion no encontrada.'));
    }

    const revoked = await repo.revoke(invitation.id, appUser.id, reason);
    if (!revoked) {
      return reply.status(409).send(publicError('conflict', 'La invitacion ya no esta activa.'));
    }

    return { data: { publicReference: revoked.publicReference, status: revoked.status } };
  });
}
