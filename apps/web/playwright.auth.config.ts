import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_AUTH_BASE_URL || 'http://127.0.0.1:8090';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'auth.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: {},
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
});
