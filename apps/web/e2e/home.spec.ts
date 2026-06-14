import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('public landing', () => {
  test('loads the home from the real public opportunities API', async ({ page }) => {
    const apiResponse = page.waitForResponse((response) => response.url().includes('/api/v1/opportunities') && response.status() === 200);
    await page.goto('/');
    await apiResponse;

    await expect(
      page.getByRole('heading', {
        name: /inversión inmobiliaria con disciplina, datos y seguimiento operativo/i
      })
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: /navegación principal/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /tesis de inversión/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /tecnología y análisis/i })).toBeVisible();
    await expect(page.getByRole('article', { name: /oportunidad pública/i })).toHaveCount(3);
    await expect(page.getByText(/datos ilustrativos/i).first()).toBeVisible();
    await expect(page.getByText(/objetivos no están garantizados/i)).toBeVisible();
    await expect(page.getByText(/oportunidad privada demo no pública/i)).toHaveCount(0);
    await expect(page.getByText(/retorno histórico/i)).toHaveCount(0);
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
  });

  test('opportunity CTA opens the public API detail without private fields', async ({ page, request }) => {
    await page.goto('/');
    const firstLink = page.getByRole('link', { name: /ver ficha pública/i }).first();
    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/^\/api\/v1\/opportunities\//);

    const detail = await request.get(href ?? '');
    expect(detail.ok()).toBeTruthy();
    const body = await detail.json();
    expect(body.data.highlights.length).toBeGreaterThan(0);
    expect(body.data.risks.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toMatch(/kyc|investor|document_private|admin_notes|internal_/i);
  });

  test('supports skip link keyboard navigation', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /saltar al contenido/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('has no critical or serious accessibility violations on the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('article', { name: /oportunidad pública/i })).toHaveCount(3);

    const results = await new AxeBuilder({ page }).include('main').analyze();
    const blockingViolations = results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? '')
    );

    expect(blockingViolations).toEqual([]);
  });

  test('does not overflow horizontally on mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    await expect(page.getByRole('heading', { name: /inversión inmobiliaria/i })).toBeVisible();
  });

  test('provides an accessible fullscreen mobile menu with Escape close and focus restore', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: /abrir menú/i });
    await menuButton.focus();
    await menuButton.press('Enter');
    const dialog = page.getByRole('dialog', { name: /menú de navegación/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: /solicitar acceso/i })).toBeVisible();
    await expect(dialog.getByRole('link', { name: /acceso inversores/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /idioma español seleccionado/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /menú de navegación/i })).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test('shows honest coming-soon pages for future private routes', async ({ page }) => {
    await page.goto('/acceso');
    await expect(page.getByRole('heading', { name: /acceso privado en preparación/i })).toBeVisible();
    await expect(page.getByText(/no permite iniciar sesión/i)).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /enviar|entrar|invertir/i })).toHaveCount(0);

    await page.goto('/inversores');
    await expect(page.getByRole('heading', { name: /área de inversores en preparación/i })).toBeVisible();
    await expect(page.getByText(/KYC pendiente/i)).toBeVisible();
    await expect(page.getByText(/capital potencialmente en riesgo/i)).toBeVisible();
    await expect(page.getByText(/inversión completada|beneficio seguro|plusvalía garantizada/i)).toHaveCount(0);
  });

  test('shows a visual not found page for unknown SPA routes', async ({ page }) => {
    await page.goto('/ruta-inexistente');

    await expect(page.getByRole('heading', { name: /no encontramos esta página/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/');
  });
});
