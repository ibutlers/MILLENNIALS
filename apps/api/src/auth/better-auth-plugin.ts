/**
 * Better Auth Fastify Plugin
 *
 * Mounts the Better Auth handler at /api/auth/*.
 * Converts between Fastify's request/response and the standard
 * Node.js (req, res) that Better Auth expects.
 *
 * When AUTH_MODE=*** returns 503 for all /api/auth/* routes.
 *
 * Sign-up protection: validates X-Invitation-Token header before
 * delegating to Better Auth. Better Auth v1.6.19 hooks context does
 * not reliably contain request headers, so validation happens here.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '../config.js';

interface BetterAuthServer {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (context: { headers: Headers }) => Promise<{
      user: { id: string; email: string; name?: string; emailVerified: boolean; twoFactorEnabled?: boolean };
      session: { id: string; expiresAt: Date; token: string };
    } | null>;
    signOut: (headers: Headers) => Promise<void>;
  };
}

let _betterAuthServer: BetterAuthServer | null = null;

export function setBetterAuthServer(server: BetterAuthServer): void {
  _betterAuthServer = server;
}

export function getBetterAuthServer(): BetterAuthServer | null {
  return _betterAuthServer;
}


function headersFromFastifyRequest(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
}

export interface InvitationValidator {
  validateToken(token: string, email: string): Promise<{ valid: boolean; reason?: string }>;
  consumeAfterSignup(token: string, email: string, betterAuthUserId: string, userName?: string): Promise<void>;
  reconcileAfterSignup(email: string, betterAuthUserId: string): Promise<void>;
  transitionAfterEmailVerification(betterAuthUserId: string): Promise<void>;
}

function extractToken(headers: Record<string, string | string[] | undefined>): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'x-invitation-token') {
      if (Array.isArray(value)) return value[0] || null;
      return value || null;
    }
  }
  return null;
}

function extractBetterAuthUser(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const body = payload as Record<string, unknown>;
  if (body.user && typeof body.user === 'object') return body.user as Record<string, unknown>;
  if (body.data && typeof body.data === 'object') {
    const data = body.data as Record<string, unknown>;
    if (data.user && typeof data.user === 'object') return data.user as Record<string, unknown>;
    if (typeof data.id === 'string') return data;
  }
  if (typeof body.id === 'string') return body;
  return undefined;
}

export async function betterAuthPlugin(
  app: FastifyInstance,
  config: AppConfig,
  pool?: Pool,
  invitationValidator?: InvitationValidator,
): Promise<void> {
  app.all('/api/auth/*', async (request: FastifyRequest, reply: FastifyReply) => {
    if (config.authMode !== 'better-auth') {
      return reply.status(503).send({
        error: {
          id: `err_${Date.now().toString(36)}`,
          code: 'auth_disabled',
          message: 'La autenticación no está disponible en este momento.',
        },
      });
    }

    if (!_betterAuthServer) {
      return reply.status(503).send({
        error: {
          id: `err_${Date.now().toString(36)}`,
          code: 'auth_unavailable',
          message: 'El servicio de autenticación no está inicializado.',
        },
      });
    }


    // ── Explicit MFA reconciliation (pending_mfa → active) ──
    if (request.method === 'POST' && request.url === '/api/auth/reconcile-mfa') {
      if (!pool) {
        return reply.status(503).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'auth_unavailable', message: 'El servicio de autenticación no está inicializado.' } });
      }
      const headers = headersFromFastifyRequest(request);
      const session = await _betterAuthServer.api.getSession({ headers });
      if (!session) {
        return reply.status(401).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'unauthorized', message: 'Autenticación requerida.' } });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const authUserResult = await client.query<{
          id: string;
          emailVerified: boolean;
          twoFactorEnabled: boolean;
        }>(
          `SELECT id, email_verified AS "emailVerified", "twoFactorEnabled"
           FROM auth."user"
           WHERE id = $1
           FOR SHARE`,
          [session.user.id],
        );
        if (authUserResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(401).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'unauthorized', message: 'Autenticación requerida.' } });
        }
        const authUser = authUserResult.rows[0];
        if (!authUser.emailVerified) {
          await client.query('ROLLBACK');
          return reply.status(403).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'email_not_verified', message: 'Debes verificar tu correo antes de continuar.' } });
        }
        if (!authUser.twoFactorEnabled) {
          await client.query('ROLLBACK');
          return reply.status(409).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'mfa_not_verified', message: 'Debes completar la verificación en dos pasos.' } });
        }

        const appUserResult = await client.query<{
          id: string;
          status: string;
          email_verified_at: Date | null;
          mfa_enabled_at: Date | null;
        }>(
          `SELECT id, status, email_verified_at, mfa_enabled_at
           FROM app_users
           WHERE better_auth_user_id = $1
           FOR UPDATE`,
          [session.user.id],
        );
        if (appUserResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(401).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'unauthorized', message: 'Usuario no registrado en el sistema.' } });
        }
        const appUser = appUserResult.rows[0];
        if (appUser.status === 'suspended') {
          await client.query('ROLLBACK');
          return reply.status(403).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'account_suspended', message: 'La cuenta está suspendida.' } });
        }
        if (appUser.status === 'revoked') {
          await client.query('ROLLBACK');
          return reply.status(403).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'account_revoked', message: 'La cuenta ha sido revocada.' } });
        }
        if (appUser.status === 'active') {
          await client.query('COMMIT');
          return { data: { status: 'active', reconciled: false } };
        }
        if (appUser.status !== 'pending_mfa') {
          await client.query('ROLLBACK');
          return reply.status(409).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'invalid_state', message: 'La cuenta todavía no está lista para activar MFA.' } });
        }

        await client.query(
          `UPDATE app_users
           SET status = 'active',
               email_verified_at = COALESCE(email_verified_at, now()),
               mfa_enabled_at = COALESCE(mfa_enabled_at, now()),
               activated_at = COALESCE(activated_at, now()),
               updated_at = now()
           WHERE id = $1`,
          [appUser.id],
        );
        await client.query(
          `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result)
           VALUES ($1, 'mfa_enabled', $2, 'app_user', $3, 'success')`,
          [appUser.id, appUser.id, appUser.id],
        );
        await client.query('COMMIT');
        return { data: { status: 'active', reconciled: true } };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        request.log.warn({ err: error }, 'mfa reconciliation failed');
        return reply.status(500).send({ error: { id: `err_${Date.now().toString(36)}`, code: 'internal_error', message: 'No hemos podido completar la solicitud en este momento.' } });
      } finally {
        client.release();
      }
    }

    // ── Sign-up invitation validation ──
    if (request.method === 'POST' && request.url === '/api/auth/sign-up/email') {
      if (!invitationValidator) {
        return reply.status(403).send({
          error: {
            id: `err_${Date.now().toString(36)}`,
            code: 'invitation_required',
            message: 'El registro requiere invitación.',
          },
        });
      }

      const rawToken: string | null = extractToken(request.headers as Record<string, string | string[] | undefined>);
      if (rawToken === null || rawToken.length < 32) {
        return reply.status(403).send({
          error: {
            id: `err_${Date.now().toString(36)}`,
            code: 'invitation_required',
            message: 'Se requiere un token de invitación válido para registrarse.',
          },
        });
      }

      const body = request.body as { email?: string } | undefined;
      const email: string | undefined = body?.email?.toLowerCase().trim();
      if (!email || !email.includes('@')) {
        return reply.status(400).send({
          error: {
            id: `err_${Date.now().toString(36)}`,
            code: 'bad_request',
            message: 'El email proporcionado no es válido.',
          },
        });
      }

      const forbiddenFields = ['role', 'status', 'userId', 'permissions', 'admin', 'staff'];
      if (body) {
        for (const field of forbiddenFields) {
          if ((body as Record<string, unknown>)[field] !== undefined) {
            return reply.status(403).send({
              error: {
                id: `err_${Date.now().toString(36)}`,
                code: 'forbidden_fields',
                message: 'La solicitud contiene campos no permitidos.',
              },
            });
          }
        }
      }

      const result = await invitationValidator.validateToken(rawToken, email);
      if (!result.valid) {
        return reply.status(403).send({
          error: {
            id: `err_${Date.now().toString(36)}`,
            code: 'invalid_invitation',
            message: 'La invitación no es válida, ha expirado o ya ha sido utilizada.',
          },
        });
      }
    }

    try {
      const webRequest = fastifyRequestToWebRequest(request);
      const webResponse = await _betterAuthServer.handler(webRequest);

      // ── Post-signup: consume invitation ──
      if (request.method === 'POST' && request.url === '/api/auth/sign-up/email' && webResponse.ok && invitationValidator) {
        const rawToken: string | null = extractToken(request.headers as Record<string, string | string[] | undefined>);
        const body = request.body as { email?: string } | undefined;
        const email: string | undefined = body?.email?.toLowerCase().trim();
        if (rawToken !== null && email) {
          try {
            const token: string = rawToken; // narrowed after null check
            const responseBody = await webResponse.clone().json().catch(() => null);
            const baUser = extractBetterAuthUser(responseBody);
            let betterAuthUserId = String(baUser?.id || '');
            let userName: string | undefined = typeof baUser?.name === 'string' ? baUser.name : undefined;
            if (!betterAuthUserId && pool) {
              const userLookup = await pool.query(
                `SELECT id, name FROM auth."user" WHERE lower(email) = lower($1) ORDER BY created_at DESC LIMIT 1`,
                [email],
              );
              if (userLookup.rows.length > 0) {
                betterAuthUserId = String(userLookup.rows[0].id || '');
                userName = typeof userLookup.rows[0].name === 'string' ? userLookup.rows[0].name : userName;
              }
            }
            if (betterAuthUserId) {
              try {
                await invitationValidator.consumeAfterSignup(token, email, betterAuthUserId, userName);
              } catch {
                await invitationValidator.reconcileAfterSignup(email, betterAuthUserId);
              }
            } else {
              request.log.warn('signup succeeded but Better Auth user id was not available for invitation consumption');
            }
          } catch {
            request.log.warn('invitation consumption after signup failed');
          }
        }
      }

      // ── Post-verification: transition pending_email → pending_mfa ──
      if (request.method === 'GET' && request.url.startsWith('/api/auth/verify-email') && webResponse.ok && invitationValidator) {
        try {
          const responseBody = await webResponse.clone().json().catch(() => null);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baUser = (responseBody as any)?.user as Record<string, unknown> | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const betterAuthUserId = String(baUser?.id || (responseBody as any)?.id || '');
          if (betterAuthUserId) {
            await invitationValidator.transitionAfterEmailVerification(betterAuthUserId);
          }
        } catch {
          request.log.warn('post-verification transition failed');
        }
      }


      await webResponseToFastifyReply(webResponse, reply);
    } catch (error) {
      request.log.error({ err: error }, 'better-auth handler error');
      return reply.status(500).send({
        error: {
          id: `err_${Date.now().toString(36)}`,
          code: 'internal_error',
          message: 'No hemos podido completar la solicitud en este momento.',
        },
      });
    }
  });
}

function fastifyRequestToWebRequest(request: FastifyRequest): Request {
  const url = `${request.protocol}://${request.hostname}${request.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }

  let body: string | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    if (typeof request.body === 'string') {
      body = request.body;
    } else {
      body = JSON.stringify(request.body);
    }
  }

  return new Request(url, {
    method: request.method,
    headers,
    body,
  });
}

async function webResponseToFastifyReply(
  response: Response,
  reply: FastifyReply,
): Promise<void> {
  reply.status(response.status);

  const setCookieHeaders: string[] = [];
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie') {
      setCookieHeaders.push(value);
    } else if (lower !== 'content-length') {
      reply.header(key, value);
    }
  });

  if (setCookieHeaders.length === 1) {
    reply.header('set-cookie', setCookieHeaders[0]);
  } else if (setCookieHeaders.length > 1) {
    const raw = reply.raw;
    const existing = raw.getHeader('set-cookie');
    if (!existing) {
      raw.setHeader('set-cookie', setCookieHeaders);
    } else {
      const existingArr: string[] = Array.isArray(existing) ? existing.map(String) : [String(existing)];
      raw.setHeader('set-cookie', existingArr.concat(setCookieHeaders));
    }
  }

  const contentType = response.headers.get('content-type') || '';
  if (response.status === 302 || response.status === 301 || response.status === 303 || response.status === 307 || response.status === 308) {
    return reply.send('');
  }

  const text = await response.text();
  if (!text) {
    return reply.send('');
  }
  if (contentType.includes('application/json')) {
    return reply.send(JSON.parse(text));
  } else if (contentType.includes('text/')) {
    return reply.send(text);
  } else {
    return reply.send(text);
  }
}
