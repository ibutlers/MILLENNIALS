export type AuthMode = 'disabled' | 'better-auth';

export type AppConfig = {
  leadsEnabled: boolean;
  privacyControllerName: string;
  privacyContactEmail: string;
  privacyPolicyVersion: string;
  leadsRateLimitMax: number;
  leadsRateLimitWindowMs: number;
  // Auth
  authMode: AuthMode;
  /** @deprecated Use authMode instead. True when authMode !== 'disabled' */
  authEnabled: boolean;
  registrationEnabled: boolean;
  emailDeliveryEnabled: boolean;
  e2eTestMode: boolean;
  e2eInternalSecret?: string;
  appBaseUrl: string;
  sessionCookieSecure: boolean;
  sessionTtlSeconds: number;
  sessionIdleTtlSeconds: number;
  emailVerificationTtlSeconds: number;
  passwordResetTtlSeconds: number;
  authRateLimitMax: number;
  authRateLimitWindowMs: number;
  // Better Auth
  betterAuthSecret?: string;
  betterAuthUrl?: string;
  betterAuthTrustedOrigins: string[];
  betterAuthCookiePrefix: string;
  betterAuthRequire2FA: boolean;
  authEmailMode: 'disabled' | 'capture' | 'smtp';
  authEmailFrom: string;
  authEmailReplyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  authInvitationTtlHours: number;
  authSessionExpiresHours: number;
  authPasswordMinLength: number;
  // Admin
  adminEnabled: boolean;
  adminMediaUploadEnabled: boolean;
  demoSeedEnabled: boolean;
};

function bool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function num(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (!value) return 'disabled';
  const normalized = value.toLowerCase().trim();
  if (normalized === 'better-auth' || normalized === 'better_auth') return 'better-auth';
  if (normalized === 'disabled') return 'disabled';
  throw new Error(
    `AUTH_MODE="${value}" no es válido. Valores permitidos: disabled, better-auth.`
  );
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function getConfig(): AppConfig {
  const authMode = parseAuthMode(process.env.AUTH_MODE);

  return {
    leadsEnabled: bool(process.env.LEADS_ENABLED, false),
    privacyControllerName: process.env.PRIVACY_CONTROLLER_NAME?.trim() ?? '',
    privacyContactEmail: process.env.PRIVACY_CONTACT_EMAIL?.trim() ?? '',
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION?.trim() ?? '2026-06-14',
    leadsRateLimitMax: num(process.env.LEADS_RATE_LIMIT_MAX, 5),
    leadsRateLimitWindowMs: num(process.env.LEADS_RATE_LIMIT_WINDOW_MS, 900_000),
    // Auth
    authMode,
    authEnabled: authMode !== 'disabled',
    registrationEnabled: bool(process.env.REGISTRATION_ENABLED, false),
    emailDeliveryEnabled: bool(process.env.EMAIL_DELIVERY_ENABLED, false),
    e2eTestMode: bool(process.env.E2E_TEST_MODE, false),
    e2eInternalSecret: process.env.E2E_INTERNAL_SECRET?.trim() || undefined,
    appBaseUrl: (process.env.APP_BASE_URL ?? 'http://65.108.251.196:8088').replace(/\/+$/, ''),
    sessionCookieSecure: bool(process.env.SESSION_COOKIE_SECURE, true),
    sessionTtlSeconds: num(process.env.SESSION_TTL_SECONDS, 86400),
    sessionIdleTtlSeconds: num(process.env.SESSION_IDLE_TTL_SECONDS, 3600),
    emailVerificationTtlSeconds: num(process.env.EMAIL_VERIFICATION_TTL_SECONDS, 1800),
    passwordResetTtlSeconds: num(process.env.PASSWORD_RESET_TTL_SECONDS, 1800),
    authRateLimitMax: num(process.env.AUTH_RATE_LIMIT_MAX, 10),
    authRateLimitWindowMs: num(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 900_000),
    // Better Auth
    betterAuthSecret: process.env.BETTER_AUTH_SECRET?.trim() || undefined,
    betterAuthUrl: process.env.BETTER_AUTH_URL?.trim() || undefined,
    betterAuthTrustedOrigins: parseCommaSeparated(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
    betterAuthCookiePrefix: process.env.BETTER_AUTH_COOKIE_PREFIX?.trim() || 'mc',
    betterAuthRequire2FA: bool(process.env.BETTER_AUTH_REQUIRE_2FA, true),
    authEmailMode: (process.env.AUTH_EMAIL_MODE?.trim() || 'disabled') as 'disabled' | 'capture' | 'smtp',
    authEmailFrom: process.env.AUTH_EMAIL_FROM?.trim() || '',
    authEmailReplyTo: process.env.AUTH_EMAIL_REPLY_TO?.trim() || '',
    smtpHost: process.env.SMTP_HOST?.trim() || '',
    smtpPort: num(process.env.SMTP_PORT, 587),
    smtpSecure: bool(process.env.SMTP_SECURE, false),
    smtpUser: process.env.SMTP_USER?.trim() || '',
    smtpPassword: process.env.SMTP_PASSWORD?.trim() || '',
    authInvitationTtlHours: num(process.env.AUTH_INVITATION_TTL_HOURS, 48),
    authSessionExpiresHours: num(process.env.AUTH_SESSION_EXPIRES_HOURS, 8),
    authPasswordMinLength: num(process.env.AUTH_PASSWORD_MIN_LENGTH, 12),
    // Admin
    adminEnabled: bool(process.env.ADMIN_ENABLED, false),
    adminMediaUploadEnabled: bool(process.env.ADMIN_MEDIA_UPLOAD_ENABLED, false),
    demoSeedEnabled: bool(process.env.DEMO_SEED_ENABLED, false),
  };
}

export function leadsCaptureAvailable(config: AppConfig): boolean {
  return Boolean(config.leadsEnabled && config.privacyControllerName && config.privacyContactEmail && config.privacyPolicyVersion);
}

export function isSecureConfig(config: AppConfig): boolean {
  return config.appBaseUrl.startsWith('https://');
}

export function isBetterAuthEnabled(config: AppConfig): boolean {
  return config.authMode === 'better-auth';
}

export function rejectInsecureAuth(config: AppConfig): void {
  const isE2E = config.e2eTestMode && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e');
  const isLocalhost = config.appBaseUrl.includes('127.0.0.1') || config.appBaseUrl.includes('localhost');

  if (config.e2eTestMode && !(isE2E && isLocalhost)) {
    throw new Error('E2E_TEST_MODE=true is only allowed in isolated localhost test environments.');
  }
  if (config.e2eTestMode && (!config.e2eInternalSecret || config.e2eInternalSecret.length < 64)) {
    throw new Error('E2E_INTERNAL_SECRET is required for isolated E2E test mode and must be at least 64 characters.');
  }

  // Better Auth validation
  if (config.authMode === 'better-auth') {
    // Require HTTPS unless E2E localhost
    if (!isSecureConfig(config) && !(isE2E && isLocalhost)) {
      throw new Error(
        'AUTH_MODE=better-auth requires APP_BASE_URL to use https://. ' +
        'Authentication is not safe over plain HTTP. ' +
        `Current APP_BASE_URL: ${config.appBaseUrl}`
      );
    }

    // Require secret
    if (!config.betterAuthSecret || config.betterAuthSecret.length < 32) {
      throw new Error(
        'AUTH_MODE=better-auth requires BETTER_AUTH_SECRET with at least 32 characters.'
      );
    }

    // Require email config when email delivery is enabled
    if (config.authEmailMode === 'smtp') {
      if (!config.smtpHost || !config.smtpUser) {
        throw new Error(
          'AUTH_EMAIL_MODE=smtp requires SMTP_HOST and SMTP_USER to be configured.'
        );
      }
    }

    // Reject forbidden bypass modes
    if (process.env.AUTH_MODE_OVERRIDE || process.env.DEV_BYPASS || process.env.MOCK_USERS ||
        process.env.SKIP_AUTH || process.env.FAKE_SESSION || process.env.TEST_ADMIN) {
      throw new Error(
        'Bypass authentication variables detected. These are not allowed in any environment.'
      );
    }
  }

  if (config.adminEnabled && config.authMode === 'disabled') {
    throw new Error(
      'ADMIN_ENABLED=true requires AUTH_MODE=better-auth. ' +
      'The admin panel cannot function without authentication.'
    );
  }
  if (config.adminEnabled && !isSecureConfig(config) && !(isE2E && isLocalhost)) {
    throw new Error(
      'ADMIN_ENABLED=true requires APP_BASE_URL to use https://. ' +
      'The admin panel is not safe over plain HTTP.'
    );
  }
}
