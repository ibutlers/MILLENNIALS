import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for investor E2E tests.
 * The environment is provisioned and torn down by scripts/run-e2e.sh.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'investor.spec.ts',
  testIgnore: ['home.spec.ts', 'admin.spec.ts', 'diagnostic.spec.ts'],
  use: {
    baseURL: 'http://127.0.0.1:8090',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
});
