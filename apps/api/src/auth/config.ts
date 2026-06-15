export type AuthConfig = {
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
};

function bool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function num(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getAuthConfig(): AuthConfig {
  return {
    authEnabled: bool(process.env.AUTH_ENABLED, false),
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
  };
}

export function isSecureConfig(config: AuthConfig): boolean {
  return config.appBaseUrl.startsWith('https://');
}

export function rejectInsecureAuth(config: AuthConfig): void {
  const isE2E = config.e2eTestMode && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e');
  const isLocalhost = config.appBaseUrl.includes('127.0.0.1') || config.appBaseUrl.includes('localhost');

  if (config.e2eTestMode && !(isE2E && isLocalhost)) {
    throw new Error('E2E_TEST_MODE=true is only allowed in isolated localhost test environments.');
  }
  if (config.e2eTestMode && (!config.e2eInternalSecret || config.e2eInternalSecret.length < 64)) {
    throw new Error('E2E_INTERNAL_SECRET is required for isolated E2E test mode and must be at least 64 characters.');
  }

  if (config.authEnabled && !isSecureConfig(config) && !(isE2E && isLocalhost)) {
    throw new Error(
      'AUTH_ENABLED=true requires APP_BASE_URL to use https://. ' +
      'Authentication is not safe over plain HTTP. ' +
      `Current APP_BASE_URL: ${config.appBaseUrl}`
    );
  }
}
