export interface AdminConfig {
  adminEnabled: boolean;
  adminMediaUploadEnabled: boolean;
  demoSeedEnabled: boolean;
}

function bool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getAdminConfig(overrides?: Partial<AdminConfig>): AdminConfig {
  const base: AdminConfig = {
    adminEnabled: bool(process.env.ADMIN_ENABLED, false),
    adminMediaUploadEnabled: bool(process.env.ADMIN_MEDIA_UPLOAD_ENABLED, false),
    demoSeedEnabled: bool(process.env.DEMO_SEED_ENABLED, false),
  };

  if (overrides) {
    return { ...base, ...overrides };
  }

  return base;
}

export function rejectInsecureAdminConfig(config: {
  adminEnabled: boolean;
  authEnabled: boolean;
  appBaseUrl: string;
}): void {
  if (!config.adminEnabled) return;

  if (!config.authEnabled) {
    throw new Error(
      'ADMIN_ENABLED=true requires AUTH_ENABLED=true. ' +
        'Admin panel must not be exposed without authentication.'
    );
  }

  if (!config.appBaseUrl.startsWith('https://')) {
    throw new Error(
      'ADMIN_ENABLED=true requires APP_BASE_URL to use https://. ' +
        'Admin panel is not safe over plain HTTP. ' +
        `Current APP_BASE_URL: ${config.appBaseUrl}`
    );
  }
}

/**
 * Fastify preHandler guard that rejects requests when the admin panel is disabled.
 * Returns `true` to allow the request to proceed, or `false` after sending a 503.
 *
 * Usage:
 *   fastify.get('/admin', { preHandler: (req, reply) => adminGate(config, reply, req) }, handler);
 *   // or inline:
 *   if (!adminGate(config, reply, request)) return;
 */
export function adminGate(
  config: { adminEnabled: boolean },
  reply: { status: (code: number) => { send: (payload: unknown) => void } },
  _request: unknown
): boolean {
  if (!config.adminEnabled) {
    reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Admin panel is disabled.',
    });
    return false;
  }
  return true;
}
