export type AppConfig = {
  leadsEnabled: boolean;
  privacyControllerName: string;
  privacyContactEmail: string;
  privacyPolicyVersion: string;
  leadsRateLimitMax: number;
  leadsRateLimitWindowMs: number;
};

function bool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function num(value: string | undefined, defaultValue: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getConfig(): AppConfig {
  return {
    leadsEnabled: bool(process.env.LEADS_ENABLED, false),
    privacyControllerName: process.env.PRIVACY_CONTROLLER_NAME?.trim() ?? '',
    privacyContactEmail: process.env.PRIVACY_CONTACT_EMAIL?.trim() ?? '',
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION?.trim() ?? '2026-06-14',
    leadsRateLimitMax: num(process.env.LEADS_RATE_LIMIT_MAX, 5),
    leadsRateLimitWindowMs: num(process.env.LEADS_RATE_LIMIT_WINDOW_MS, 900_000)
  };
}

export function leadsCaptureAvailable(config: AppConfig) {
  return Boolean(config.leadsEnabled && config.privacyControllerName && config.privacyContactEmail && config.privacyPolicyVersion);
}
