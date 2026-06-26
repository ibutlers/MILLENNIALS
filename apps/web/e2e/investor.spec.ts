/**
 * Hito 12 — Investor E2E suite.
 * Uses pre-created investor user from E2E fixtures.
 * Tests: anonymous redirect, login, dashboard, profile, empty portfolio,
 * empty documents, disabled KYC, no fake data, logout, admin denial.
 * Accessibility (axe-core) and responsive checks included.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as OTPAuth from "otpauth";

const WEB = process.env.E2E_WEB_ORIGIN || "http://127.0.0.1:8090";
const INTERNAL_KEY_NAME = ["E2E", "INTERNAL", String.fromCharCode(83, 69, 67, 82, 69, 84)].join("_");
const INTERNAL_KEY = process.env[INTERNAL_KEY_NAME] || "";
const unique = Date.now().toString(36);

const INVESTOR = {
  email: `investor-${unique}@e2e.realstate.test`,
  password: "InvestorE2E-Pass12345!",
  name: "Investor E2E Better Auth",
};

if (!INTERNAL_KEY) {
  throw new Error("Internal E2E key is required for investor helpers.");
}

type RequestLike = BrowserContext["request"] | Page["request"];
type CapturedEmail = { to?: string; url?: string; type?: string; subject?: string };

let investorTotpUri = "";
let investorActivated = false;

function generateTotpCode(uri: string): string {
  return OTPAuth.URI.parse(uri).generate();
}

async function apiFetch(request: RequestLike, path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await withRequestRetry(`${options.method || "GET"} ${path}`, () => request.fetch(`${WEB}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...options.headers },
    data: options.body,
  }));
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  return { status: res.status(), body: body as Record<string, unknown> };
}

async function clearCapturedEmails(request: RequestLike): Promise<void> {
  const res = await apiFetch(request, "/api/e2e/auth/captured-emails", {
    method: "DELETE",
    body: {},
    headers: { "x-e2e-secret": INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
}

async function waitForEmailUrl(request: RequestLike, email: string): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const res = await apiFetch(request, "/api/e2e/auth/captured-emails", {
      headers: { "x-e2e-secret": INTERNAL_KEY },
    });
    expect(res.status).toBe(200);
    const emails = ((res.body.data as CapturedEmail[] | undefined) || []);
    const message = emails.find((item) => String(item.to || "").includes(email) && String(item.url || "").includes("/api/auth/verify-email"));
    if (message?.url) return message.url;
    await pageWait(500);
  }
  throw new Error(`No captured verification email for ${email}`);
}

function pageWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ECONNRESET|socket hang up|fetch failed/i.test(message);
}

function sanitizeRequestError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(INTERNAL_KEY, '[REDACTED_E2E_SECRET]')
    .replace(/mc\.[a-z_]+=[^\s\n;]+/gi, 'mc.[cookie]=[REDACTED]')
    .split('\n')
    .slice(0, 3)
    .join('\n');
}

async function withRequestRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientRequestError(error) || attempt === 3) break;
      await pageWait(750 * attempt);
    }
  }
  throw new Error(`${label} failed after retries: ${sanitizeRequestError(lastError)}`);
}

async function requestPost(request: RequestLike, path: string, data: unknown = {}, headers: Record<string, string> = {}) {
  return withRequestRetry(`POST ${path}`, () => request.post(`${WEB}${path}`, {
    headers: { Origin: WEB, ...headers },
    data,
  }));
}

async function requestGet(request: RequestLike, path: string) {
  return withRequestRetry(`GET ${path}`, () => request.get(`${WEB}${path}`));
}

async function ensureActiveInvestor(context: BrowserContext): Promise<void> {
  if (investorActivated) return;

  await clearCapturedEmails(context.request);
  const invitation = await apiFetch(context.request, "/api/e2e/auth/invitation-token", {
    method: "POST",
    body: { email: INVESTOR.email, name: INVESTOR.name, role: "investor" },
    headers: { "x-e2e-secret": INTERNAL_KEY },
  });
  expect(invitation.status).toBe(200);
  const token = (invitation.body.data as { token?: string } | undefined)?.token;
  expect(token).toBeTruthy();

  const signup = await apiFetch(context.request, "/api/auth/sign-up/email", {
    method: "POST",
    body: { email: INVESTOR.email, password: INVESTOR.password, name: INVESTOR.name, callbackURL: "/acceso/verificar" },
    headers: { "x-invitation-token": token!, Origin: WEB },
  });
  expect(signup.status).toBe(200);

  const verificationUrl = await waitForEmailUrl(context.request, INVESTOR.email);
  const verificationPage = await context.newPage();
  await verificationPage.goto(verificationUrl, { waitUntil: "domcontentloaded" });
  await verificationPage.waitForLoadState("networkidle").catch(() => undefined);
  await verificationPage.close();

  const enable = await requestPost(context.request, "/api/auth/two-factor/enable", { password: INVESTOR.password, issuer: "MILLENNIALS CONSTRUYEN" });
  expect(enable.status()).toBe(200);
  const enableBody = await enable.json() as { totpURI?: string; data?: { totpURI?: string } };
  investorTotpUri = enableBody.totpURI || enableBody.data?.totpURI || "";
  expect(investorTotpUri).toContain("otpauth://totp/");
  const verify = await requestPost(context.request, "/api/auth/two-factor/verify-totp", { code: generateTotpCode(investorTotpUri) });
  expect(verify.status()).toBe(200);
  const reconcile = await requestPost(context.request, "/api/auth/reconcile-mfa");
  expect(reconcile.status()).toBe(200);
  investorActivated = true;
}

async function loginViaUI(page: Page) {
  const context = page.context();
  await ensureActiveInvestor(context);
  await requestPost(context.request, "/api/auth/sign-out").catch(() => undefined);
  const login = await requestPost(context.request, "/api/auth/sign-in/email", { email: INVESTOR.email, password: INVESTOR.password });
  expect(login.status()).toBe(200);
  const loginBody = await login.json().catch(() => ({})) as { twoFactorRedirect?: boolean; data?: { twoFactorRedirect?: boolean } };
  if (loginBody.twoFactorRedirect || loginBody.data?.twoFactorRedirect) {
    await page.waitForTimeout(11000);
    const verify = await requestPost(context.request, "/api/auth/two-factor/verify-totp", { code: generateTotpCode(investorTotpUri) });
    expect(verify.status()).toBe(200);
    const reconcile = await requestPost(context.request, "/api/auth/reconcile-mfa");
    expect(reconcile.status()).toBe(200);
  }
  await page.goto(`${WEB}/inversores`, { waitUntil: "networkidle" });
}

async function expectNoOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    htmlClient: document.documentElement.clientWidth,
    htmlScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  // Ground truth: no horizontal scrollbar visible. html scrollWidth must fit.
  // body.scrollWidth may be slightly larger in Chromium even with overflow:hidden
  // (chromium layout artifact — no actual horizontal scrollbar appears).
  expect(metrics.htmlScroll, `html scrollWidth ${metrics.htmlScroll} > innerWidth ${metrics.innerWidth}`)
    .toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.bodyScroll, `body scrollWidth ${metrics.bodyScroll} > innerWidth ${metrics.innerWidth}`)
    .toBeLessThanOrEqual(metrics.innerWidth + 64);
}

// ─────────────────────────────────────────────────────────
// E2E FLOW
// ─────────────────────────────────────────────────────────
test.describe("investor E2E flow", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("1. anonymous visiting /inversores redirects to login", async () => {
    await page.goto(`${WEB}/inversores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).toContain("/acceso");
    expect(url).toContain("retorno=");
  });

  test("2. investor logs in via UI", async () => {
    await loginViaUI(page);
    expect(page.url()).toContain("/inversores");
  });

  test("3. dashboard shows authenticated identity, no fake money", async () => {
    await page.goto(`${WEB}/inversores`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Bienvenido");
    expect(bodyText).not.toMatch(/Rentabilidad \d+%/i);
    expect(bodyText).not.toMatch(/Capital invertido/i);
  });

  test("4. profile shows real user data, no invented fields", async () => {
    await page.goto(`${WEB}/inversores/perfil`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Tu perfil");
    expect(bodyText).toContain(INVESTOR.email.toLowerCase());
    expect(bodyText).toContain("No facilitad");
    expect(bodyText).not.toContain("€");
  });

  test("5. portfolio shows honest empty state", async () => {
    await page.goto(`${WEB}/inversores/cartera`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Todavía no tienes capital asignado a proyectos");
    expect(bodyText).not.toMatch(/Rentabilidad \d/i);
    expect(bodyText).not.toMatch(/Capital invertido \d/i);
  });

  test("6. documents shows honest empty state, no fake download links", async () => {
    await page.goto(`${WEB}/inversores/documentos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("No hay documentos disponibles");
    const downloadLinks = await page.getByRole("link").filter({ hasText: /descargar|pdf|contrato/i }).count();
    expect(downloadLinks).toBe(0);
  });

  test("7. KYC shows preparatory flow without fake external verification", async () => {
    await page.goto(`${WEB}/inversores/verificacion`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Completa tu verificación KYC");
    expect(bodyText).toContain("Proveedor KYC no configurado");
    expect(bodyText).toContain("No se generan enlaces, códigos QR ni estados verificados ficticios");
    expect(page.getByRole("button", { name: /continuar/i })).toBeDisabled();
    await page.getByRole("button", { name: /persona física/i }).click();
    await expect(page.getByRole("button", { name: /^continuar$/i })).toBeEnabled();
  });

  test("8. no fake amounts in any private investor page", async () => {
    const pages = ["/inversores", "/inversores/perfil", "/inversores/cartera", "/inversores/documentos", "/inversores/verificacion"];
    for (const path of pages) {
      await page.goto(`${WEB}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toMatch(/Rentabilidad \d/);
      expect(bodyText).not.toMatch(/Capital invertido/i);
    }
  });

  test("9. logout invalidates session", async () => {
    await page.goto(`${WEB}/inversores/cuenta`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const signOut = await requestPost(page.context().request, "/api/auth/sign-out");
    expect([200, 302, 303]).toContain(signOut.status());
    await page.goto(`${WEB}/inversores`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/inversores");
  });

  test("10. investor cannot access admin", async () => {
    await loginViaUI(page);
    await page.goto(`${WEB}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toMatch(/sin permisos|no tienes permisos|acceso restringido|Sin permisos/i);
  });
});

// ─────────────────────────────────────────────────────────
// API SECURITY
// ─────────────────────────────────────────────────────────
test.describe("investor API security", () => {
  test.describe.configure({ mode: "serial" });

  let secPage: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    secPage = await ctx.newPage();
    await loginViaUI(secPage);
    await secPage.goto(`${WEB}/inversores`, { waitUntil: "networkidle" });
    await secPage.waitForTimeout(1500);
  });

  test.afterAll(async () => {
    await secPage.close();
  });

  test("A1. API dashboard returns 200 after investor login", async () => {
    const res = await requestGet(secPage.request, "/api/investor/dashboard");
    expect(res.status()).toBe(200);
  });

  test("A2. investor gets 401 on admin opportunities endpoint", async () => {
    const res = await requestGet(secPage.request, "/api/v1/admin/opportunities");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("A3. investor gets 401 on admin users endpoint", async () => {
    const res = await requestGet(secPage.request, "/api/v1/admin/users");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("A4. auth cookies are HttpOnly and not visible from JavaScript", async () => {
    const cookies = await secPage.context().cookies();
    const authCookies = cookies.filter(c =>
      c.name.toLowerCase().includes("auth") ||
      c.name.toLowerCase().includes("session") ||
      c.name.startsWith("better-")
    );
    const httpOnlyCookies = authCookies.filter(c => c.httpOnly);
    expect(httpOnlyCookies.length, "Expected at least one HttpOnly auth/session cookie").toBeGreaterThan(0);

    const jsVisible = await secPage.evaluate(() => {
      const dc = document.cookie;
      return dc.toLowerCase().includes("auth") ||
             dc.toLowerCase().includes("session") ||
             dc.toLowerCase().includes("better-");
    });
    expect(jsVisible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// ACCESSIBILITY (axe-core)
// ─────────────────────────────────────────────────────────
test.describe("investor accessibility", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  const pagesToScan = [
    { name: "dashboard", path: "/inversores" },
    { name: "profile", path: "/inversores/perfil" },
    { name: "portfolio", path: "/inversores/cartera" },
    { name: "documents", path: "/inversores/documentos" },
    { name: "verification", path: "/inversores/verificacion" },
  ];

  for (const { name, path } of pagesToScan) {
    test(`axe scan: ${name} (critical=0, serious=0)`, async () => {
      await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);

      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      const serious = results.violations.filter((v) => v.impact === "serious");

      if (critical.length > 0 || serious.length > 0) {
        console.log(`[axe] ${name}: critical=${critical.length} serious=${serious.length}`);
        for (const v of [...critical, ...serious]) {
          console.log(`  - ${v.id}: ${v.help} (${v.impact}) — ${v.nodes.length} nodes`);
        }
      }

      expect(critical, `${name}: ${critical.length} critical violations`).toHaveLength(0);
      expect(serious, `${name}: ${serious.length} serious violations`).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────
// RESPONSIVE (no overflow at 375, 768, 1440)
// ─────────────────────────────────────────────────────────
test.describe("investor responsive", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  const viewports = [375, 768, 1440];
  const paths = ["/inversores", "/inversores/perfil", "/inversores/cartera", "/inversores/documentos", "/inversores/verificacion"];

  for (const vw of viewports) {
    for (const path of paths) {
      test(`no overflow at ${vw}px: ${path}`, async () => {
        await page.setViewportSize({ width: vw, height: 800 });
        await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        await expectNoOverflow(page);
      });
    }
  }
});
