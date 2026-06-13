import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('public landing', () => {
  test('loads the refined institutional home page, narrative and opportunity cards', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /inversión inmobiliaria con disciplina, datos y seguimiento operativo/i
      })
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: /navegación principal/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /tesis de inversión/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /tecnología y análisis/i })).toBeVisible();
    await expect(page.getByRole('article', { name: /oportunidad demo/i })).toHaveCount(3);
    await expect(page.getByText(/datos ilustrativos/i).first()).toBeVisible();
    await expect(page.getByText(/retorno histórico/i)).toHaveCount(0);
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

  test('shows a visual not found page for unknown SPA routes', async ({ page }) => {
    await page.goto('/ruta-inexistente');

    await expect(page.getByRole('heading', { name: /no encontramos esta página/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute('href', '/');
  });
});
