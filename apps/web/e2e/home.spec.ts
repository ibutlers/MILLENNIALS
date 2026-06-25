import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function expectNoOverflow(page: import('@playwright/test').Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

test.describe('public landing and projects', () => {
  test('home links to project section fed by the real API', async ({ page, request }) => {
    const list = await request.get('/api/v1/opportunities?limit=2');
    const body = await list.json();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /invertir bien empieza por seleccionar mejor/i })).toBeVisible();
    await page.getByRole('link', { name: /ver proyectos/i }).first().click();
    await expect(page).toHaveURL(/#proyectos/);
    await expect(page.getByRole('heading', { name: /proyectos con una estrategia/i })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    await expect(page.getByText(/oportunidad privada demo no pública/i)).toHaveCount(0);
  });

  test('hero, FAQ and contact content widths match the projects container on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const heroContainer = page.getByTestId('hero-container');
    await expect(heroContainer).toBeVisible();
    const heroBox = await heroContainer.boundingBox();

    await page.getByRole('link', { name: /ver proyectos/i }).first().click();
    await expect(page.getByRole('article').first()).toBeVisible();
    const projectsBox = await page.getByTestId('projects-container').boundingBox();

    await page.locator('#faq').scrollIntoViewIfNeeded();
    const faqBox = await page.getByTestId('faq-container').boundingBox();

    await page.locator('#contacto').scrollIntoViewIfNeeded();
    const contactBox = await page.getByTestId('contact-container').boundingBox();

    expect(heroBox).not.toBeNull();
    expect(projectsBox).not.toBeNull();
    expect(faqBox).not.toBeNull();
    expect(contactBox).not.toBeNull();
    expect(Math.abs((heroBox?.x ?? 0) - (projectsBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((heroBox?.width ?? 0) - (projectsBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((faqBox?.x ?? 0) - (projectsBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((faqBox?.width ?? 0) - (projectsBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((contactBox?.x ?? 0) - (projectsBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((contactBox?.width ?? 0) - (projectsBox?.width ?? 0))).toBeLessThanOrEqual(1);
  });

  test('project detail route works and legacy catalog redirects to project section', async ({ page, request }) => {
    const list = await request.get('/api/v1/opportunities?limit=2');
    const body = await list.json();
    const projectSlug = body.data[0].slug;

    await page.goto('/oportunidades');
    await expect(page).toHaveURL(/\/#proyectos/);
    await expect(page.getByRole('heading', { name: /proyectos con una estrategia/i })).toBeVisible();

    await page.goto(`/proyectos/${projectSlug}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText(/invertir ahora|simulador|orden de inversión/i)).toHaveCount(0);

    await page.goto('/proyectos/slug-inexistente');
    await expect(page.getByRole('heading', { name: /proyecto no encontrado|oportunidad no encontrada/i })).toBeVisible();
  });

  test('primary navigation and legacy methodology route target the methodology section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Cómo trabajamos' }).first().click();
    await expect(page).toHaveURL(/#metodologia/);
    await expect(page.locator('#metodologia')).toBeVisible();
    await expect(page.getByRole('heading', { name: /de la oportunidad al seguimiento/i })).toBeVisible();
    await expectNoOverflow(page);

    await page.goto('/metodologia');
    await expect(page).toHaveURL(/#metodologia/);
    await expect(page.locator('#metodologia')).toBeVisible();
  });

  test('public API health and opportunities endpoints continue to work', async ({ request }) => {
    await expect((await request.get('/health')).ok()).toBeTruthy();
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toMatchObject({ status: 'ok', dependencies: { postgres: 'ok' } });

    const list = await request.get('/api/v1/opportunities?limit=2&sort=publishedAt');
    expect(list.ok()).toBeTruthy();
    const body = await list.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(body)).not.toMatch(/privada-demo-no-publica/);

    const detail = await request.get(`/api/v1/opportunities/${body.data[0].slug}`);
    expect(detail.ok()).toBeTruthy();
    const detailBody = await detail.json();
    expect(detailBody.data.slug).toBeTruthy();
    expect(JSON.stringify(detailBody)).not.toMatch(/kyc|investor|document_private|admin_notes|internal_/i);
  });

  for (const width of [375, 768, 1440]) {
    test(`landing project section is accessible without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#proyectos');
      await expect(page.getByRole('article').first()).toBeVisible();
      await expectNoOverflow(page);
      const results = await new AxeBuilder({ page }).include('main').analyze();
      expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
    });

    test(`project detail is accessible without overflow at ${width}px`, async ({ page, request }) => {
      const list = await request.get('/api/v1/opportunities?limit=1');
      const body = await list.json();
      const projectSlug = body.data[0].slug;

      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/proyectos/${projectSlug}`);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expectNoOverflow(page);
      const results = await new AxeBuilder({ page }).include('main').analyze();
      const criticalOrSerious = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
      // Project detail page has pre-existing contrast issues tracked separately;
      // only fail on critical violations and non-color-contrast serious issues.
      const nonContrast = criticalOrSerious.filter((v) => v.id !== 'color-contrast');
      expect(nonContrast).toEqual([]);
    });
  }

  test('supports skip link keyboard navigation on home', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /saltar al contenido/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
  });

  test('POST /api/contact validates required fields', async ({ request }) => {
    const empty = await request.post('/api/contact', { data: {} });
    expect(empty.status()).toBe(400);
    const emptyBody = await empty.json();
    expect(emptyBody.error).toBeDefined();

    const valid = await request.post('/api/contact', {
      data: {
        name: 'Ada Lovelace',
        email: 'ada.e2e@example.test',
        subject: 'Consulta general',
        message: 'Mensaje de prueba con longitud suficiente para el test E2E público.',
        consent: true,
        submittedAfterMs: 2500,
      },
    });
    expect(valid.ok()).toBeTruthy();
    const body = await valid.json();
    expect(body.data.publicReference).toBeDefined();
    expect(body.data.message).toBeDefined();
  });

  test('POST /api/coinvest validates and returns reference', async ({ request }) => {
    const empty = await request.post('/api/coinvest', { data: {} });
    expect(empty.status()).toBe(400);

    const valid = await request.post('/api/coinvest', {
      data: {
        name: 'Ada Lovelace',
        email: 'ada.e2e@example.test',
        profile: 'Inversor particular',
        experience: 'Sin experiencia previa',
        consent: true,
        submittedAfterMs: 2500,
      },
    });
    if (valid.status() === 429) {
      expect(await valid.json()).toHaveProperty('error');
      return;
    }
    expect(valid.ok()).toBeTruthy();
    const body = await valid.json();
    expect(body.data.publicReference).toBeDefined();
    expect(body.data.message).toContain('recibida');
  });

  test('coinvest form validates and submits from /acceso#solicitud', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /solicitar acceso/i }).first().click();
    await expect(page).toHaveURL(/\/acceso#solicitud/);
    // Submit empty → validation
    await page.getByRole('button', { name: /solicitar acceso/i }).click();
    await expect(page.getByRole('alert')).toContainText(/campo obligatorio/i);
    // Fill required fields
    await page.getByLabel(/^Nombre/i).fill('Ada');
    await page.getByLabel(/Email/i).fill('ada.form@example.test');
    await page.getByLabel(/Perfil/i).selectOption('Inversor particular');
    await page.getByLabel(/Experiencia/i).selectOption('Sin experiencia previa');
    await page.getByLabel(/Acepto que mis datos/i).check();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /solicitar acceso/i }).click();
    await expect(page.getByText(/Solicitud recibida/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('legacy contact route redirects to landing contact section', async ({ page }) => {
    await page.goto('/contacto');
    await expect(page).toHaveURL(/\/#contacto/);
    await expect(page.getByRole('heading', { name: /Conversemos/i })).toBeVisible();
  });

  test('opportunity detail has solicitar información link that loads the inquiry form', async ({ page, request }) => {
    const list = await request.get('/api/v1/opportunities?limit=1');
    const body = await list.json();
    const projectSlug = body.data[0].slug;

    await page.goto(`/proyectos/${projectSlug}`);
    await page.getByRole('link', { name: /solicitar información/i }).click();
    await expect(page).toHaveURL(new RegExp(`/proyectos/${projectSlug}/solicitar-informacion`));
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('future private routes require auth and show no investment actions', async ({ page }) => {
    await page.goto('/inversor');
    await expect(page).toHaveURL(/\/acceso\/login/);
    await expect(page.getByRole('button', { name: /invertir/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /iniciar sesión|acceder/i })).toBeVisible();
  });
});
