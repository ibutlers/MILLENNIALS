import { defineConfig, devices } from '@playwright/test';

/**
 * Multi-browser smoke tests for investor area.
 * Runs login → dashboard → portfolio → documents → logout
 * across Chromium, Firefox, and WebKit.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'investor-smoke.spec.ts',
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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
});
