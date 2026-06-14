import { test, expect } from '@playwright/test';

const WEB = 'http://127.0.0.1:8090';
const API = 'http://127.0.0.1:8089';

test.describe('Playwright Block Diagnosis', () => {
  test.describe.configure({ mode: 'serial', timeout: 30_000 });

  test('1. Frontend serves HTML', async ({ page }) => {
    console.log('[diag] navigating to frontend...');
    const resp = await page.goto(WEB, { timeout: 10_000, waitUntil: 'domcontentloaded' });
    console.log('[diag] frontend status: ' + resp?.status());
    expect(resp?.status()).toBe(200);
    console.log('[diag] frontend OK');
  });

  test('2. API health responds', async ({ request }) => {
    console.log('[diag] checking API health...');
    const resp = await request.get(API + '/api/health', { timeout: 5_000 });
    console.log('[diag] API health status: ' + resp.status());
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    console.log('[diag] API health body: ' + JSON.stringify(body));
    expect(body.status).toBe('ok');
  });

  test('3. Login page renders', async ({ page }) => {
    console.log('[diag] navigating to /acceso...');
    await page.goto(WEB + '/acceso', { timeout: 10_000, waitUntil: 'domcontentloaded' });
    console.log('[diag] login page title: ' + await page.title());
    const emailInput = page.locator('input[name="email"]');
    console.log('[diag] email input visible: ' + (await emailInput.isVisible().catch(() => false)));
    const passInput = page.locator('input[name="password"]');
    console.log('[diag] password input visible: ' + (await passInput.isVisible().catch(() => false)));
    const submitBtn = page.locator('button[type="submit"]');
    console.log('[diag] submit button visible: ' + (await submitBtn.isVisible().catch(() => false)));
  });

  test('4. API login works', async ({ request }) => {
    console.log('[diag] attempting login...');
    const resp = await request.post(API + '/api/v1/auth/login', {
      data: { email: 'admin@e2e.realstate.test', password: 'AdminE2E-Pass123!' },
      headers: { 'Content-Type': 'application/json' },
      timeout: 5_000,
    });
    console.log('[diag] login status: ' + resp.status());
    const body = await resp.json();
    if (body.error) {
      console.log('[diag] login error: ' + body.error.code + ' - ' + body.error.message);
    } else {
      console.log('[diag] login OK, user id: ' + body.data?.id);
    }
  });
});
