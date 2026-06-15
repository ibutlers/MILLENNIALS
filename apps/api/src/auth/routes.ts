import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AuthConfig } from './config.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSessionToken, hashToken } from './sessions.js';
import { AuthRepository } from './repository.js';
import { AuthRateLimiter } from './rateLimit.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  userResponseSchema,
} from './schemas.js';
import type { EmailTransport } from './email.js';
import { createEmailContent } from './email.js';

const SESSION_COOKIE = 'realstate_sid';

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

function setSessionCookie(reply: FastifyReply, token: string, config: AuthConfig): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.sessionCookieSecure,
    path: '/api',
    maxAge: config.sessionTtlSeconds,
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/api' });
}

function hashUserAgent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHash('sha256').update(value).digest('hex');
}

function e2eNotFound() {
  return publicError('not_found', 'No hay token pendiente para este email.');
}

function safeSecretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function requireE2ESecret(request: FastifyRequest, config: AuthConfig): boolean {
  const header = request.headers['x-e2e-secret'];
  const provided = Array.isArray(header) ? header[0] : header;
  return safeSecretMatches(provided, config.e2eInternalSecret);
}

function pruneExpiredOutboxEntries(outbox: Map<string, { token: string; expiresAt: number }>, now = Date.now()): void {
  for (const [email, entry] of outbox.entries()) {
    if (now > entry.expiresAt) outbox.delete(email);
  }
}

/** Get userId from session cookie, or null if invalid. */
async function getUserIdFromSession(
  request: FastifyRequest,
  repo: AuthRepository,
): Promise<string | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await repo.findSessionByTokenHash(tokenHash);
  if (!session || session.revokedAt) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  await repo.touchSession(session.id);
  return session.userId;
}

export interface AuthRoutesOptions {
  pool: Pool;
  repo: AuthRepository;
  config: AuthConfig;
  emailTransport: EmailTransport;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  const { repo, config, emailTransport } = options;
  const loginLimiter = new AuthRateLimiter(config.authRateLimitMax, config.authRateLimitWindowMs);
  const forgotLimiter = new AuthRateLimiter(config.authRateLimitMax, config.authRateLimitWindowMs);

  // ── E2E test token outbox (in-memory, accessible only via test endpoint) ──
  const testTokens = new Map<string, { token: string; expiresAt: number }>();
  const testPasswordResetTokens = new Map<string, { token: string; expiresAt: number }>();

  // ── Auth disabled guard ──
  const authEnabled = (reply: FastifyReply) => {
    if (!config.authEnabled) {
      void reply.status(503).send(publicError('auth_disabled', 'La autenticación todavía no está habilitada.'));
      return false;
    }
    return true;
  };

  // ── POST /register ──
  app.post('/api/v1/auth/register', async (request, reply) => {
    if (!authEnabled(reply)) return;
    if (!config.registrationEnabled) {
      return reply.status(503).send(publicError('registration_disabled', 'El registro todavía no está habilitado.'));
    }

    const body = registerSchema.parse(request.body);
    const emailNormalized = body.email.toLowerCase().trim();

    const existing = await repo.findUserByEmail(emailNormalized);
    if (existing) {
      // Anti-enumeration: generic message
      return reply.status(409).send(publicError('conflict', 'No se ha podido completar el registro.'));
    }

    const passwordHash = await hashPassword(body.password);
    const user = await repo.createUser({
      email: body.email.trim(),
      emailNormalized,
      passwordHash,
      name: body.name.trim(),
    });

    // Create verification token
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.emailVerificationTtlSeconds * 1000);
    await repo.createVerificationToken(user.id, tokenHash, expiresAt);

    // Send verification email (or log in test mode)
    if (config.emailDeliveryEnabled) {
      const content = createEmailContent({ type: 'verification', token }, config.appBaseUrl);
      await emailTransport.send({ to: body.email, ...content });
    } else if (config.e2eTestMode) {
      pruneExpiredOutboxEntries(testTokens);
      testTokens.set(emailNormalized, { token, expiresAt: expiresAt.getTime() });
      request.log.info({ emailNormalized }, 'verification token stored in E2E outbox');
    }

    await repo.recordAuditEvent({
      eventType: 'account_created',
      userId: user.id,
      metadata: {},
    });

    request.log.info({ userId: user.id, emailNormalized }, 'user registered');
    return reply.status(201).send({
      data: {
        id: user.id,
        email: user.email,
        name: body.name.trim(),
        status: 'pending_email_verification',
        createdAt: user.createdAt,
      },
    });
  });

  // ── POST /login ──
  app.post('/api/v1/auth/login', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const origin = request.ip || 'unknown';
    const rate = loginLimiter.check(origin);
    if (!rate.allowed) {
      return reply.status(429).send(publicError('rate_limited', 'Demasiados intentos. Inténtalo más tarde.'));
    }

    const body = loginSchema.parse(request.body);
    const emailNormalized = body.email.toLowerCase().trim();

    const user = await repo.findUserByEmail(emailNormalized);

    // Anti-enumeration: same error for wrong email and wrong password
    if (!user || !user.passwordHash) {
      await repo.recordAuditEvent({
        eventType: 'login_failure',
        userId: user?.id,
        metadata: { reason: user ? 'wrong_password' : 'unknown_email' },
      });
      return reply.status(401).send(publicError('invalid_credentials', 'Credenciales incorrectas.'));
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      await repo.recordAuditEvent({
        eventType: 'login_failure',
        userId: user.id,
        metadata: { reason: 'wrong_password' },
      });
      return reply.status(401).send(publicError('invalid_credentials', 'Credenciales incorrectas.'));
    }

    if (user.status === 'disabled' || user.status === 'suspended') {
      return reply.status(403).send(publicError('account_disabled', 'La cuenta está deshabilitada.'));
    }

    // Create session
    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
    await repo.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgentHash: hashUserAgent(request.headers['user-agent']),
    });
    await repo.updateLastLogin(user.id);

    await repo.recordAuditEvent({
      eventType: 'login_success',
      userId: user.id,
      metadata: {},
    });

    setSessionCookie(reply, token, config);
    request.log.info({ userId: user.id }, 'user logged in');
    return { data: { id: user.id, email: user.email, status: user.status } };
  });

  // ── POST /logout ──
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const userId = await getUserIdFromSession(request, repo);
    const token = request.cookies[SESSION_COOKIE];

    if (userId && token) {
      const tokenHash = hashToken(token);
      const session = await repo.findSessionByTokenHash(tokenHash);
      if (session && !session.revokedAt) {
        await repo.revokeSession(session.id);
        await repo.recordAuditEvent({
          eventType: 'logout',
          userId,
          sessionId: session.id,
          metadata: {},
        });
      }
    }

    clearSessionCookie(reply);
    return { data: { message: 'Sesión cerrada.' } };
  });

  // ── GET /me ──
  app.get('/api/v1/auth/me', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const userId = await getUserIdFromSession(request, repo);
    if (!userId) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    const user = await repo.findUserById(userId);
    if (!user || user.status === 'disabled') {
      clearSessionCookie(reply);
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    const roles = await repo.getUserRoles(userId);

    return userResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: 'Usuario', // name not stored separately in MVP schema
      roles,
      status: user.status,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
    });
  });

  // ── POST /verify-email ──
  app.post('/api/v1/auth/verify-email', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const body = verifyEmailSchema.parse(request.body);
    const tokenHash = hashToken(body.token);

    const result = await repo.consumeVerificationToken(tokenHash);
    if (!result) {
      return reply.status(400).send(publicError('invalid_token', 'El enlace de verificación no es válido o ha caducado.'));
    }

    await repo.verifyEmail(result.userId);
    await repo.recordAuditEvent({
      eventType: 'email_verified',
      userId: result.userId,
      metadata: {},
    });

    return { data: { message: 'Dirección de correo verificada correctamente.' } };
  });

  // ── POST /resend-verification ──
  app.post('/api/v1/auth/resend-verification', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const body = resendVerificationSchema.parse(request.body);
    const emailNormalized = body.email.toLowerCase().trim();

    const user = await repo.findUserByEmail(emailNormalized);
    // Anti-enumeration: always return success
    if (!user || user.emailVerifiedAt) {
      return { data: { message: 'Si la cuenta existe, recibirás un nuevo enlace de verificación.' } };
    }

    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.emailVerificationTtlSeconds * 1000);
    await repo.createVerificationToken(user.id, tokenHash, expiresAt);

    if (config.emailDeliveryEnabled) {
      const content = createEmailContent({ type: 'verification', token }, config.appBaseUrl);
      await emailTransport.send({ to: body.email, ...content });
    }

    return { data: { message: 'Si la cuenta existe, recibirás un nuevo enlace de verificación.' } };
  });

  // ── POST /forgot-password ──
  app.post('/api/v1/auth/forgot-password', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const origin = request.ip || 'unknown';
    const rate = forgotLimiter.check(origin);
    if (!rate.allowed) {
      return reply.status(429).send(publicError('rate_limited', 'Demasiadas solicitudes. Inténtalo más tarde.'));
    }

    const body = forgotPasswordSchema.parse(request.body);
    const emailNormalized = body.email.toLowerCase().trim();

    const user = await repo.findUserByEmail(emailNormalized);

    // Anti-enumeration: always return same response
    if (user) {
      const token = createSessionToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + config.passwordResetTtlSeconds * 1000);
      await repo.createPasswordResetToken(user.id, tokenHash, expiresAt);

      if (config.emailDeliveryEnabled) {
        const content = createEmailContent({ type: 'password-reset', token }, config.appBaseUrl);
        await emailTransport.send({ to: body.email, ...content });
      } else if (config.e2eTestMode) {
        pruneExpiredOutboxEntries(testPasswordResetTokens);
        testPasswordResetTokens.set(emailNormalized, { token, expiresAt: expiresAt.getTime() });
        request.log.info({ emailNormalized }, 'password reset token stored in E2E outbox');
      }

      await repo.recordAuditEvent({
        eventType: 'password_reset_requested',
        userId: user.id,
        metadata: {},
      });
    }

    return { data: { message: 'Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.' } };
  });

  // ── POST /reset-password ──
  app.post('/api/v1/auth/reset-password', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const body = resetPasswordSchema.parse(request.body);
    const tokenHash = hashToken(body.token);

    const result = await repo.consumePasswordResetToken(tokenHash);
    if (!result) {
      return reply.status(400).send(publicError('invalid_token', 'El enlace de restablecimiento no es válido o ha caducado.'));
    }

    const passwordHash = await hashPassword(body.password);
    await repo.updatePassword(result.userId, passwordHash);

    // Revoke all sessions on password reset
    await repo.revokeUserSessions(result.userId);

    await repo.recordAuditEvent({
      eventType: 'password_reset_completed',
      userId: result.userId,
      metadata: {},
    });

    return { data: { message: 'Contraseña restablecida correctamente.' } };
  });

  // ── GET /sessions ──
  app.get('/api/v1/auth/sessions', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const userId = await getUserIdFromSession(request, repo);
    if (!userId) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    const currentToken = request.cookies[SESSION_COOKIE];
    const currentTokenHash = currentToken ? hashToken(currentToken) : null;

    const sessions = await repo.listUserSessions(userId);
    const mapped = sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: currentTokenHash !== null && s.id === currentTokenHash ? false : false,
    }));

    // Mark current session — find which session matches the current cookie
    if (currentTokenHash) {
      const currentSession = await repo.findSessionByTokenHash(currentTokenHash);
      if (currentSession) {
        const idx = mapped.findIndex((s) => s.id === currentSession.id);
        if (idx >= 0) {
          mapped[idx] = { ...mapped[idx], isCurrent: true };
        }
      }
    }

    return { data: mapped };
  });

  // ── DELETE /sessions/:id ──
  app.delete('/api/v1/auth/sessions/:id', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const userId = await getUserIdFromSession(request, repo);
    if (!userId) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    const { id } = request.params as { id: string };
    const sessions = await repo.listUserSessions(userId);
    const target = sessions.find((s) => s.id === id);

    if (!target) {
      return reply.status(404).send(publicError('not_found', 'Sesión no encontrada.'));
    }

    await repo.revokeSession(id);
    await repo.recordAuditEvent({
      eventType: 'session_revoked',
      userId,
      sessionId: id,
      metadata: {},
    });

    return { data: { message: 'Sesión cerrada.' } };
  });

  // ── DELETE /sessions (revoke all) ──
  app.delete('/api/v1/auth/sessions', async (request, reply) => {
    if (!authEnabled(reply)) return;

    const userId = await getUserIdFromSession(request, repo);
    if (!userId) {
      return reply.status(401).send(publicError('unauthorized', 'Autenticación requerida.'));
    }

    await repo.revokeUserSessions(userId);
    await repo.recordAuditEvent({
      eventType: 'session_revoked',
      userId,
      metadata: { allSessions: true },
    });

    clearSessionCookie(reply);
    return { data: { message: 'Todas las sesiones han sido cerradas.' } };
  });

  if (config.e2eTestMode) {
    // ── E2E TEST ONLY: GET /api/v1/e2e/verification-token/:email ──
    app.get('/api/v1/e2e/verification-token/:email', async (request, reply) => {
      if (!authEnabled(reply)) return;
      if (!requireE2ESecret(request, config)) {
        return reply.status(404).send(e2eNotFound());
      }

      const email = (request.params as { email: string }).email.toLowerCase().trim();
      const entry = testTokens.get(email);

      if (!entry) {
        return reply.status(404).send(publicError('not_found', 'No hay token pendiente para este email.'));
      }

      if (Date.now() > entry.expiresAt) {
        testTokens.delete(email);
        return reply.status(410).send(publicError('expired', 'El token ha caducado.'));
      }

      // Consume the token (single use)
      testTokens.delete(email);

      return {
        data: {
          token: entry.token,
          email,
          expiresAt: new Date(entry.expiresAt).toISOString(),
        },
      };
    });
  }

  if (config.e2eTestMode) {
    // ── E2E TEST ONLY: GET /api/v1/e2e/password-reset-token/:email ──
    app.get('/api/v1/e2e/password-reset-token/:email', async (request, reply) => {
      if (!authEnabled(reply)) return;
      if (!requireE2ESecret(request, config)) {
        return reply.status(404).send(e2eNotFound());
      }

      const email = (request.params as { email: string }).email.toLowerCase().trim();
      const entry = testPasswordResetTokens.get(email);

      if (!entry) {
        return reply.status(404).send(publicError('not_found', 'No hay token pendiente para este email.'));
      }

      if (Date.now() > entry.expiresAt) {
        testPasswordResetTokens.delete(email);
        return reply.status(410).send(publicError('expired', 'El token ha caducado.'));
      }

      testPasswordResetTokens.delete(email);

      return {
        data: {
          token: entry.token,
          email,
          expiresAt: new Date(entry.expiresAt).toISOString(),
        },
      };
    });
  }
}
