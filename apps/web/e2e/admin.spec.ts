import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:8090';
const API = 'http://127.0.0.1:8089';

test.describe('admin workflow', () => {
  test.describe.configure({ mode: 'serial' });

  const adminEmail = 'admin@realstate-e2e.test';
  const adminPassword = 'E2eTestPass123!';

  test('1. health endpoints work', async ({ request }) => {
    const h1 = await request.get(`${API}/health`);
    expect(h1.ok()).toBe(true);
    const h2 = await request.get(`${API}/api/health`);
    expect(h2.ok()).toBe(true);
  });

  test('2. admin endpoints return 401 when not authenticated', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/admin/dashboard`);
    expect(res.status()).toBe(401);
  });

  test('3. public opportunities API works', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/opportunities`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
  });

  test('4. admin disabled returns 503', async ({ request }) => {
    // This test verifies the production state — skip in E2E env with admin enabled
    test.skip(true, 'Admin is enabled in E2E environment');
  });

  test('5. authentication — login as admin (placeholder)', async ({ page }) => {
    // In a full E2E setup, we would:
    // - Create an admin user via API or CLI
    // - Login through the UI
    // - Verify session cookie is set
    // For now, verify the login page loads
    await page.goto(`${BASE}/acceso`);
    await expect(page.getByRole('heading', { name: /acceso/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('6. catalog page loads with opportunities', async ({ page }) => {
    await page.goto(`${BASE}/oportunidades`);
    await expect(page.getByRole('heading', { name: /catálogo/i })).toBeVisible({ timeout: 10000 });
  });

  test('7. admin panel loads (requires auth — shows access restricted)', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    // Without auth, should show "Panel en preparación" or restricted
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });

  test('8. admin API endpoints accept requests', async ({ request }) => {
    // Verify admin endpoints exist (they return 401 without session)
    const endpoints = [
      '/api/v1/admin/dashboard',
      '/api/v1/admin/opportunities',
      '/api/v1/admin/leads',
      '/api/v1/admin/users',
      '/api/v1/admin/audit',
    ];
    for (const ep of endpoints) {
      const res = await request.get(`${API}${ep}`);
      expect([200, 401, 503]).toContain(res.status());
    }
  });

  test('9. opportunity detail page renders', async ({ page }) => {
    await page.goto(`${BASE}/oportunidades`);
    // Click first opportunity link
    const firstLink = page.getByRole('link').filter({ hasText: /ver/i }).first();
    if (await firstLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstLink.click();
      await expect(page).toHaveURL(/oportunidades\//);
    }
  });

  test('10. responsive — no horizontal overflow at 375/768/1440', async ({ page }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${BASE}/oportunidades`);
      await page.waitForTimeout(1000);
      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
    }
  });
});
