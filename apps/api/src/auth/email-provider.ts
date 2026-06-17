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
  health(): { configured: boolean; status: string };
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
// Factory
// ---------------------------------------------------------------------------

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
