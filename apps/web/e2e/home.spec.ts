import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function expectNoOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

test.describe('public opportunities milestone', () => {
  test('home links to catalog fed by the real API', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /inversión inmobiliaria con disciplina/i })).toBeVisible();
    await page.getByRole('link', { name: /ver oportunidades demo/i }).first().click();
    await expect(page).toHaveURL(/\/oportunidades/);
    await expect(page.getByRole('heading', { name: /catálogo público/i })).toBeVisible();
    await expect(page.getByRole('article', { name: /oportunidad pública/i })).toHaveCount(4);
    await expect(page.getByText(/oportunidad privada demo no pública/i)).toHaveCount(0);
  });

  test('filters, opens a detail page and returns preserving URL filters', async ({ page }) => {
    await page.goto('/oportunidades?city=Barcelona&riskLevel=medium&sort=fundingProgress&direction=desc');
    await expect(page.getByLabel(/ciudad/i)).toHaveValue('Barcelona');
    await expect(page.getByLabel(/riesgo/i)).toHaveValue('medium');
    await expect(page.getByRole('article', { name: /oportunidad pública/i })).toHaveCount(1);

    await page.getByRole('link', { name: /ver oportunidad/i }).first().click();
    await expect(page).toHaveURL(/\/oportunidades\/eixample-rehabilitacion-luminosa/);
    await expect(page.getByRole('heading', { name: /rehabilitación luminosa en eixample/i })).toBeVisible();
    await expect(page.getByText(/solicitar información/i)).toBeVisible();
    await expect(page.getByText(/invertir ahora|simulador|orden de inversión/i)).toHaveCount(0);

    await page.getByRole('link', { name: /^Oportunidades$/ }).click();
    await expect(page).toHaveURL(/city=Barcelona/);
    await expect(page.getByLabel(/ciudad/i)).toHaveValue('Barcelona');
    await expect(page.getByLabel(/riesgo/i)).toHaveValue('medium');
  });

  test('catalog direct refresh and unknown detail route work', async ({ page }) => {
    await page.goto('/oportunidades');
    await page.reload();
    await expect(page.getByRole('heading', { name: /catálogo público/i })).toBeVisible();
    await expect(page.getByRole('article', { name: /oportunidad pública/i }).first()).toBeVisible();

    await page.goto('/oportunidades/slug-inexistente');
    await expect(page.getByRole('heading', { name: /oportunidad no encontrada/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/oportunidades');
  });

  test('public API health and opportunities endpoints continue to work', async ({ request }) => {
    await expect((await request.get('/health')).ok()).toBeTruthy();
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toMatchObject({ status: 'ok', dependencies: { postgres: 'ok' } });

    const list = await request.get('/api/v1/opportunities?limit=2&sort=publishedAt');
    expect(list.ok()).toBeTruthy();
    const body = await list.json();
    expect(body.data).toHaveLength(2);
    expect(JSON.stringify(body)).not.toMatch(/privada-demo-no-publica/);

    const detail = await request.get(`/api/v1/opportunities/${body.data[0].slug}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = await detail.json();
    expect(detailBody.data.risks.length).toBeGreaterThan(0);
    expect(JSON.stringify(detailBody)).not.toMatch(/kyc|investor|document_private|admin_notes|internal_/i);
  });

  for (const width of [375, 768, 1440]) {
    test(`catalog and detail are accessible without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/oportunidades');
      await expect(page.getByRole('article', { name: /oportunidad pública/i }).first()).toBeVisible();
      await expectNoOverflow(page);
      let results = await new AxeBuilder({ page }).include('main').analyze();
      expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);

      await page.goto('/oportunidades/eixample-rehabilitacion-luminosa');
      await expect(page.getByRole('heading', { name: /rehabilitación luminosa/i })).toBeVisible();
      await expectNoOverflow(page);
      results = await new AxeBuilder({ page }).include('main').analyze();
      expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
    });
  }

  test('supports skip link keyboard navigation on home', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /saltar al contenido/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('lead forms submit successfully in the controlled E2E environment', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /solicitar acceso/i }).first().click();
    await expect(page).toHaveURL(/\/solicitar-acceso/);
    await page.getByRole('button', { name: /enviar solicitud/i }).click();
    await expect(page.getByRole('alert')).toContainText(/campo obligatorio/i);
    await page.getByLabel(/^Nombre/i).fill('Ada');
    await page.getByLabel(/Apellidos/i).fill('Lovelace');
    await page.getByLabel(/Email/i).fill('ada@example.test');
    await page.getByLabel(/Acepto la información de privacidad/i).check();
    await page.waitForTimeout(1600);
    await page.getByRole('button', { name: /enviar solicitud/i }).click();
    await expect(page.getByText(/RS-\d{8}-[A-F0-9]+/)).toBeVisible();

    await page.goto('/contacto');
    await expect(page.getByRole('heading', { name: /contactar con/i })).toBeVisible();

    await page.goto('/oportunidades/eixample-rehabilitacion-luminosa');
    await page.getByRole('link', { name: /solicitar información/i }).click();
    await expect(page).toHaveURL(/\/solicitar-informacion/);
    await expect(page.getByRole('heading', { name: /rehabilitación luminosa/i })).toBeVisible();
  });

  test('future private routes show login when auth enabled, no investment actions', async ({ page }) => {
    await page.goto('/inversores');
    // Auth is enabled in E2E; investor dashboard requires login
    await expect(page.getByRole('heading', { name: /acceso inversores/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /invertir/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /acceder/i })).toBeVisible();
  });
});
