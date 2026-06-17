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
    getSession: (headers: Headers) => Promise<{
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

export interface InvitationValidator {
  validateToken(token: string, email: string): Promise<{ valid: boolean; reason?: string }>;
  consumeAfterSignup(token: string, email: string, betterAuthUserId: string, userName?: string): Promise<void>;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const baUser = (responseBody as any)?.user as Record<string, unknown> | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const betterAuthUserId = String(baUser?.id || (responseBody as any)?.id || '');
            const userName: string | undefined = baUser?.name as string | undefined;
            if (betterAuthUserId) {
              await invitationValidator.consumeAfterSignup(token, email, betterAuthUserId, userName);
            }
          } catch {
            request.log.warn('invitation consumption after signup failed');
          }
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
  if (contentType.includes('application/json')) {
    const body = await response.json();
    return reply.send(body);
  } else if (contentType.includes('text/')) {
    const body = await response.text();
    return reply.send(body);
  } else if (response.status === 302 || response.status === 301) {
    return reply.send('');
  } else {
    const body = await response.text();
    return reply.send(body);
  }
}
