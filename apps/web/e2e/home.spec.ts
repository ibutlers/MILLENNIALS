import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('public landing', () => {
  test('loads the home page, navigation and search experience', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /encuentra una propiedad con criterio, datos y acompañamiento experto/i
      })
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: /navegación principal/i })).toBeVisible();
    await expect(page.getByRole('search', { name: /buscar propiedades/i })).toBeVisible();
    await expect(page.getByLabel(/ubicación/i)).toBeVisible();
    await expect(page.getByRole('article', { name: /propiedad destacada/i })).toHaveCount(3);
  });

  test('supports basic keyboard navigation', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /saltar al contenido/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('has no critical or serious accessibility violations on the home page', async ({ page }) => {
    await page.goto('/');

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
    await expect(page.getByRole('search', { name: /buscar propiedades/i })).toBeVisible();
  });

  test('shows a visual not found page for unknown SPA routes', async ({ page }) => {
    await page.goto('/ruta-inexistente');

    await expect(page.getByRole('heading', { name: /no encontramos esta página/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/');
  });
});
