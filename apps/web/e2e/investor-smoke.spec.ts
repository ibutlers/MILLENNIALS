/**
 * Hito 12 — Multi-browser investor smoke tests.
 * Quick login → dashboard → portfolio → documents → logout
 * across Chromium, Firefox, and WebKit.
 */
import { test, expect, type Page } from "@playwright/test";

const WEB = "http://127.0.0.1:8090";
const INVESTOR = {
  email: "investor@e2e.realstate.test",
  password: "InvestorE2E-Pass123!",
};

async function loginViaUI(page: Page) {
  await page.goto(`${WEB}/acceso`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const emailInput = page.getByLabel("Email");
  const passInput = page.getByLabel("Contraseña");

  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(INVESTOR.email);
    await passInput.fill(INVESTOR.password);
    await page.getByRole("button", { name: /ACCEDER/i }).click();
    await page.waitForURL("**/inversores**", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
}

test.describe("investor smoke (multi-browser)", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("login via UI", async () => {
    await loginViaUI(page);
    const url = page.url();
    expect(url).toContain("/inversores");
  });

  test("dashboard loads", async () => {
    await page.goto(`${WEB}/inversores`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Bienvenido");
  });

  test("portfolio shows empty", async () => {
    await page.goto(`${WEB}/inversores/cartera`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Todavía no tienes inversiones activas");
  });

  test("documents shows empty", async () => {
    await page.goto(`${WEB}/inversores/documentos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("No hay documentos disponibles");
  });

  test("logout", async () => {
    await page.goto(`${WEB}/inversores/cuenta`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const logoutButton = page.getByRole("button", { name: /Salir/i });
    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForTimeout(2000);
    }
    const url = page.url();
    expect(url).not.toContain("/inversores");
  });
});
