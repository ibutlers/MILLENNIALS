import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig } from './config.js';

const originalEnv = process.env;

describe('getConfig — postura MFA opcional', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BETTER_AUTH_REQUIRE_2FA;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('mantiene BETTER_AUTH_REQUIRE_2FA=false por defecto', () => {
    expect(getConfig().betterAuthRequire2FA).toBe(false);
  });

  it('solo exige MFA cuando BETTER_AUTH_REQUIRE_2FA=true explícitamente', () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'true';
    expect(getConfig().betterAuthRequire2FA).toBe(true);
  });

  it('mantiene MFA opcional cuando BETTER_AUTH_REQUIRE_2FA=false explícitamente', () => {
    process.env.BETTER_AUTH_REQUIRE_2FA = 'false';
    expect(getConfig().betterAuthRequire2FA).toBe(false);
  });
});
