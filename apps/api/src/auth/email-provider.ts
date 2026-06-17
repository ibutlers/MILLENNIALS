/**
 * Auth Email Provider — Interface and implementations
 *
 * Three modes:
 * - disabled: No email sending (default in production without SMTP).
 *   Prevents Better Auth from being activated in production without email.
 * - capture: Captures messages in memory (tests/development only).
 *   Never available in production.
 * - smtp: Sends real emails via SMTP (requires configuration).
 *
 * Security: Never log full email bodies, tokens, or recipient addresses.
 */

import { createTransport, type Transporter } from 'nodemailer';

export interface AuthEmailProvider {
  /** Send a verification email. url contains the verification link. */
  sendVerification(to: string, url: string): Promise<void>;

  /** Send a password reset email. url contains the reset link. */
  sendPasswordReset(to: string, url: string): Promise<void>;

  /** Send an invitation email. */
  sendInvitation(to: string, displayName: string): Promise<void>;

  /** Notify user that password was changed. */
  sendPasswordChanged(to: string): Promise<void>;

  /** Notify user that MFA was enabled. */
  sendMfaEnabled(to: string): Promise<void>;

  /** Notify user that account was suspended. */
  sendAccountSuspended(to: string, reason?: string): Promise<void>;

  /** Notify user that account was reactivated. */
  sendAccountReactivated(to: string): Promise<void>;

  /** Notify user that sessions were revoked. */
  sendSessionsRevoked(to: string): Promise<void>;

  /** Health check for the email provider. */
  health(): { configured: boolean; status: string } | Promise<{ configured: boolean; status: string }>;
}

// ---------------------------------------------------------------------------
// DisabledEmailProvider
// ---------------------------------------------------------------------------

export class DisabledEmailProvider implements AuthEmailProvider {
  async sendVerification(_to: string, _url: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendPasswordReset(_to: string, _url: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendInvitation(_to: string, _displayName: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendPasswordChanged(_to: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendMfaEnabled(_to: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendAccountSuspended(_to: string, _reason?: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendAccountReactivated(_to: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  async sendSessionsRevoked(_to: string): Promise<void> {
    // Email delivery disabled — no sending
  }

  health() {
    return { configured: false, status: 'not_configured' };
  }
}

// ---------------------------------------------------------------------------
// CaptureEmailProvider (tests/development only)
// ---------------------------------------------------------------------------

export interface CapturedEmail {
  to: string;
  type: 'verification' | 'password-reset' | 'invitation' | 'password-changed'
    | 'mfa-enabled' | 'account-suspended' | 'account-reactivated'
    | 'sessions-revoked';
  url?: string;
  timestamp: number;
}

export class CaptureEmailProvider implements AuthEmailProvider {
  public sent: CapturedEmail[] = [];

  private capture(type: CapturedEmail['type'], to: string, url?: string) {
    this.sent.push({ to, type, url, timestamp: Date.now() });
  }

  async sendVerification(to: string, url: string): Promise<void> {
    this.capture('verification', to, url);
  }

  async sendPasswordReset(to: string, url: string): Promise<void> {
    this.capture('password-reset', to, url);
  }

  async sendInvitation(to: string, _displayName: string): Promise<void> {
    this.capture('invitation', to);
  }

  async sendPasswordChanged(to: string): Promise<void> {
    this.capture('password-changed', to);
  }

  async sendMfaEnabled(to: string): Promise<void> {
    this.capture('mfa-enabled', to);
  }

  async sendAccountSuspended(to: string, _reason?: string): Promise<void> {
    this.capture('account-suspended', to);
  }

  async sendAccountReactivated(to: string): Promise<void> {
    this.capture('account-reactivated', to);
  }

  async sendSessionsRevoked(to: string): Promise<void> {
    this.capture('sessions-revoked', to);
  }

  /** Get the latest verification URL for an email (consumes it — single read). */
  getVerificationUrl(email: string): string | undefined {
    const normalized = email.toLowerCase().trim();
    const idx = this.sent.findIndex(
      e => e.to.toLowerCase().trim() === normalized && e.type === 'verification'
    );
    if (idx === -1) return undefined;
    const entry = this.sent[idx];
    this.sent.splice(idx, 1); // Consume
    return entry.url;
  }

  /** Get the latest password reset URL for an email (consumes it). */
  getPasswordResetUrl(email: string): string | undefined {
    const normalized = email.toLowerCase().trim();
    const idx = this.sent.findIndex(
      e => e.to.toLowerCase().trim() === normalized && e.type === 'password-reset'
    );
    if (idx === -1) return undefined;
    const entry = this.sent[idx];
    this.sent.splice(idx, 1); // Consume
    return entry.url;
  }

  /** Clear all captured emails. */
  clear(): void {
    this.sent = [];
  }

  health() {
    return { configured: true, status: 'capture' };
  }
}

// ---------------------------------------------------------------------------
// SmtpAuthEmailProvider
// ---------------------------------------------------------------------------

export class SmtpAuthEmailProvider implements AuthEmailProvider {
  private transporter: Transporter | null = null;
  private retries = 3;
  private retryDelayMs = 500;

  constructor(
    private config: {
      host: string; port: number; secure: boolean;
      user: string; password: string;
      from: string; replyTo: string;
      baseUrl: string;
    }
  ) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: { user: this.config.user, pass: this.config.password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      });
    }
    return this.transporter;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private redactEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local.slice(0, Math.min(1, local.length)) + '***@' + domain;
  }

  private async sendWithRetry(mailOptions: {
    to: string; subject: string; html: string; text: string;
  }): Promise<void> {
    let lastError: Error | null = null;
    const transporter = this.getTransporter();
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        await transporter.sendMail({
          from: `"MILLENNIALS CONSTRUYEN" <${this.config.from}>`,
          replyTo: this.config.replyTo || this.config.from,
          ...mailOptions,
        });
        return;
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.retries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError || new Error('SMTP send failed after retries');
  }

  async sendVerification(to: string, url: string): Promise<void> {
    const safeUrl = url.startsWith(this.config.baseUrl) ? url : this.config.baseUrl;
    await this.sendWithRetry({
      to,
      subject: 'Verifica tu dirección de correo — MILLENNIALS CONSTRUYEN',
      html: `<p>Hola,</p><p>Verifica tu email haciendo clic en el siguiente enlace:</p><p><a href="${this.escapeHtml(safeUrl)}">Verificar email</a></p><p>Si no has solicitado esta cuenta, ignora este mensaje.</p>`,
      text: `Hola,\n\nVerifica tu email aquí: ${safeUrl}\n\nSi no has solicitado esta cuenta, ignora este mensaje.`,
    });
  }

  async sendPasswordReset(to: string, url: string): Promise<void> {
    const safeUrl = url.startsWith(this.config.baseUrl) ? url : this.config.baseUrl;
    await this.sendWithRetry({
      to,
      subject: 'Recuperación de contraseña — MILLENNIALS CONSTRUYEN',
      html: `<p>Hola,</p><p>Has solicitado restablecer tu contraseña. Haz clic en el enlace:</p><p><a href="${this.escapeHtml(safeUrl)}">Restablecer contraseña</a></p><p>Si no has solicitado este cambio, ignora este mensaje.</p>`,
      text: `Hola,\n\nRestablece tu contraseña aquí: ${safeUrl}\n\nSi no has solicitado este cambio, ignora este mensaje.`,
    });
  }

  async sendInvitation(_to: string, _displayName: string): Promise<void> {
    // Invitations are handled by the application-level invitation system
    // This is a placeholder for when SMTP is fully configured
  }

  async sendPasswordChanged(to: string): Promise<void> {
    await this.sendWithRetry({
      to,
      subject: 'Contraseña modificada — MILLENNIALS CONSTRUYEN',
      html: '<p>Hola,</p><p>Tu contraseña ha sido modificada recientemente.</p><p>Si no has sido tú, contacta con nosotros inmediatamente.</p>',
      text: 'Hola,\n\nTu contraseña ha sido modificada recientemente.\n\nSi no has sido tú, contacta con nosotros inmediatamente.',
    });
  }

  async sendMfaEnabled(to: string): Promise<void> {
    await this.sendWithRetry({
      to,
      subject: 'Verificación en dos pasos activada — MILLENNIALS CONSTRUYEN',
      html: '<p>Hola,</p><p>La verificación en dos pasos (2FA) ha sido activada en tu cuenta.</p><p>Si no has sido tú, contacta con nosotros inmediatamente.</p>',
      text: 'Hola,\n\nLa verificación en dos pasos (2FA) ha sido activada en tu cuenta.\n\nSi no has sido tú, contacta con nosotros inmediatamente.',
    });
  }

  async sendAccountSuspended(to: string, _reason?: string): Promise<void> {
    await this.sendWithRetry({
      to,
      subject: 'Cuenta suspendida — MILLENNIALS CONSTRUYEN',
      html: '<p>Hola,</p><p>Tu cuenta ha sido suspendida temporalmente.</p><p>Si crees que se trata de un error, contacta con el equipo.</p>',
      text: 'Hola,\n\nTu cuenta ha sido suspendida temporalmente.\n\nSi crees que se trata de un error, contacta con el equipo.',
    });
  }

  async sendAccountReactivated(to: string): Promise<void> {
    await this.sendWithRetry({
      to,
      subject: 'Cuenta reactivada — MILLENNIALS CONSTRUYEN',
      html: '<p>Hola,</p><p>Tu cuenta ha sido reactivada. Ya puedes iniciar sesión de nuevo.</p>',
      text: 'Hola,\n\nTu cuenta ha sido reactivada. Ya puedes iniciar sesión de nuevo.',
    });
  }

  async sendSessionsRevoked(to: string): Promise<void> {
    await this.sendWithRetry({
      to,
      subject: 'Sesiones revocadas — MILLENNIALS CONSTRUYEN',
      html: '<p>Hola,</p><p>Todas tus sesiones activas han sido revocadas por seguridad.</p><p>Deberás iniciar sesión de nuevo.</p>',
      text: 'Hola,\n\nTodas tus sesiones activas han sido revocadas por seguridad.\n\nDeberás iniciar sesión de nuevo.',
    });
  }

  async health(): Promise<{ configured: boolean; status: string }> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return { configured: true, status: 'connected' };
    } catch {
      return { configured: true, status: 'error' };
    }
  }
}

export function createAuthEmailProvider(mode: string): AuthEmailProvider {
  switch (mode) {
    case 'capture':
      return new CaptureEmailProvider();
    case 'smtp':
      // SMTP provider not yet implemented — fall back to disabled
      // TODO: Implement SmtpAuthEmailProvider when SMTP is configured
      throw new Error('SMTP email provider is not yet implemented. Use "disabled" or "capture".');
    case 'disabled':
    default:
      return new DisabledEmailProvider();
  }
}
