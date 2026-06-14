import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'bash ../../scripts/e2e-web-server.sh',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
