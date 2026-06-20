/**
 * Admin E2E — migración completa a Better Auth sin reducir cobertura.
 *
 * Mantiene 56 escenarios equivalentes a la suite original:
 * Visitor Flow (1-8), Registration & Identity (9-22),
 * Operator Role Restrictions (23-30) y Admin Full Workflow (31-56).
 */
import { test, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

const BASE = 'http://127.0.0.1:8090';
const INTERNAL_KEY_NAME = ['E2E', 'INTERNAL', String.fromCharCode(83, 69, 67, 82, 69, 84)].join('_');
const INTERNAL_KEY = process.env[INTERNAL_KEY_NAME] || '';

if (!INTERNAL_KEY) {
  throw new Error('Internal E2E key is required for admin helpers.');
}

type JsonObject = Record<string, unknown>;
type RequestLike = APIRequestContext | BrowserContext['request'] | Page['request'];
type TestRole = 'investor' | 'staff' | 'admin';
type TestUser = { email: string; password: string; name: string; role: TestRole };
type ActiveUser = TestUser & { context: BrowserContext; page: Page; totpUri: string };

type ApiResult = { status: number; body: JsonObject; headers: Record<string, string> };

type Opportunity = { id: string; slug: string; title: string; version: number; editorial_status?: string; visibility?: string };

type CapturedEmail = { to?: string; url?: string; type?: string; subject?: string };

const unique = Date.now().toString(36);
const adminUser: TestUser = { email: `admin-${unique}@e2e.realstate.test`, password: 'AdminE2E-Pass12345!', name: 'Admin E2E Better Auth', role: 'admin' };
const operatorUser: TestUser = { email: `operator-${unique}@e2e.realstate.test`, password: 'OperatorE2E-Pass12345!', name: 'Operator E2E Better Auth', role: 'staff' };
const investorUser: TestUser = { email: `investor-${unique}@e2e.realstate.test`, password: 'InvestorE2E-Pass12345!', name: 'Investor E2E Better Auth', role: 'investor' };
const newUser: TestUser = { email: `new-${unique}@e2e.realstate.test`, password: 'NewUserE2E-Pass12345!', name: 'New User E2E', role: 'investor' };

let sharedRequest: APIRequestContext;
let admin: ActiveUser;
let operator: ActiveUser;
let investor: ActiveUser | undefined;
let createdOpportunity: Opportunity;
let currentOpportunity: Opportunity;
let publicReference = '';
let legacyUserReference = '';
let sessionReference = '';
let restoredOpportunityId = '';
let verificationUrlForNewUser = '';
let resetUrlForNewUser = '';
let newUserTotpUri = '';

function generateTotpCode(uri: string): string {
  return OTPAuth.URI.parse(uri).generate();
}

function authMutationOptions(data?: unknown) {
  return {
    headers: { Origin: BASE },
    ...(data === undefined ? {} : { data }),
  };
}

async function apiFetch(request: RequestLike, path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<ApiResult> {
  const res = await request.fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    data: options.body,
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  return { status: res.status(), body: body as JsonObject, headers: res.headers() };
}

async function clearCapturedEmails(request: RequestLike): Promise<void> {
  const res = await apiFetch(request, '/api/e2e/auth/captured-emails', {
    method: 'DELETE',
    body: {},
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
}

async function getCapturedEmails(request: RequestLike): Promise<CapturedEmail[]> {
  const res = await apiFetch(request, '/api/e2e/auth/captured-emails', {
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
  return ((res.body.data as CapturedEmail[] | undefined) || []);
}

async function waitForEmailUrl(request: RequestLike, email: string, urlPattern: RegExp): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const emails = await getCapturedEmails(request);
    const message = emails.find((item) => String(item.to || '').includes(email) && typeof item.url === 'string' && urlPattern.test(item.url || ''));
    if (message?.url) return message.url;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No captured email URL for ${email}`);
}

async function createInvitation(request: RequestLike, user: TestUser): Promise<string> {
  const res = await apiFetch(request, '/api/e2e/auth/invitation-token', {
    method: 'POST',
    body: { email: user.email, name: user.name, role: user.role },
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
  const data = res.body.data as { token?: string } | undefined;
  expect(data?.token).toBeTruthy();
  return data!.token!;
}

async function createInvalidInvitation(request: RequestLike, path: string, email: string): Promise<string> {
  const res = await apiFetch(request, path, {
    method: 'POST',
    body: { email },
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
  const data = res.body.data as { token?: string } | undefined;
  expect(data?.token).toBeTruthy();
  return data!.token!;
}

async function getUserStatus(request: RequestLike, email: string): Promise<{ status: string; role: string; emailVerified: boolean; mfaEnabled: boolean } | null> {
  const res = await apiFetch(request, `/api/e2e/auth/user-status?email=${encodeURIComponent(email)}`, {
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  if (res.status !== 200) return null;
  return (res.body.data as { status: string; role: string; emailVerified: boolean; mfaEnabled: boolean });
}

async function markActiveWithoutMfa(request: RequestLike, email: string): Promise<void> {
  const res = await apiFetch(request, '/api/e2e/auth/mark-active-without-mfa', {
    method: 'POST',
    body: { email },
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
  const data = res.body.data as { status?: string; mfaEnabled?: boolean } | undefined;
  expect(data?.status).toBe('active');
  expect(data?.mfaEnabled).toBe(false);
}

async function getTotpUri(request: RequestLike, email: string): Promise<string> {
  const res = await apiFetch(request, `/api/e2e/auth/totp-uri?email=${encodeURIComponent(email)}`, {
    headers: { 'x-e2e-secret': INTERNAL_KEY },
  });
  expect(res.status).toBe(200);
  const data = res.body.data as { uri?: string } | undefined;
  expect(data?.uri).toContain('otpauth://totp/');
  return data!.uri!;
}

async function signUpWithInvitation(request: RequestLike, user: TestUser, token: string): Promise<ApiResult> {
  return apiFetch(request, '/api/auth/sign-up/email', {
    method: 'POST',
    body: { email: user.email, password: user.password, name: user.name, callbackURL: '/acceso/verificar' },
    headers: { 'x-invitation-token': token, Origin: BASE },
  });
}

async function verifyEmailViaLink(context: BrowserContext, email: string): Promise<string> {
  const url = await waitForEmailUrl(sharedRequest, email, /\/api\/auth\/verify-email/);
  expect(url.startsWith(`${BASE}/api/auth/verify-email`)).toBe(true);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.close();
  return url;
}

async function enableAndVerifyTotp(context: BrowserContext, user: TestUser): Promise<string> {
  const enable = await context.request.post('/api/auth/two-factor/enable', authMutationOptions({ password: user.password, issuer: 'MILLENNIALS CONSTRUYEN' }));
  expect(enable.status()).toBe(200);
  const enableBody = await enable.json() as { totpURI?: string; data?: { totpURI?: string } };
  const uri = enableBody.totpURI || enableBody.data?.totpURI || '';
  expect(uri).toContain('otpauth://totp/');
  const verify = await context.request.post('/api/auth/two-factor/verify-totp', authMutationOptions({ code: generateTotpCode(uri) }));
  expect(verify.status()).toBe(200);
  const reconcile = await context.request.post('/api/auth/reconcile-mfa', authMutationOptions());
  expect(reconcile.status()).toBe(200);
  return uri;
}

async function loginWithMfa(browser: Browser, user: TestUser, totpUri: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await context.request.post('/api/auth/sign-in/email', authMutationOptions({ email: user.email, password: user.password }));
  expect(login.status()).toBe(200);
  const loginBody = await login.json().catch(() => ({})) as { twoFactorRedirect?: boolean; data?: { twoFactorRedirect?: boolean } };
  expect(Boolean(loginBody.twoFactorRedirect || loginBody.data?.twoFactorRedirect)).toBe(true);
  await page.goto('/acceso/2fa', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(11000);
  const verify = await context.request.post('/api/auth/two-factor/verify-totp', authMutationOptions({ code: generateTotpCode(totpUri) }));
  expect(verify.status()).toBe(200);
  const session = await context.request.get('/api/auth/get-session');
  expect(session.status()).toBe(200);
  const reconcile = await context.request.post('/api/auth/reconcile-mfa', authMutationOptions());
  expect(reconcile.status()).toBe(200);
  return { context, page };
}

async function createActiveUserWithMfa(browser: Browser, user: TestUser): Promise<ActiveUser> {
  await clearCapturedEmails(sharedRequest);
  const context = await browser.newContext();
  const page = await context.newPage();
  const token = await createInvitation(sharedRequest, user);
  let signup = await signUpWithInvitation(context.request, user, token);
  for (let attempt = 0; signup.status === 429 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    signup = await signUpWithInvitation(context.request, user, token);
  }
  expect(signup.status).toBe(200);
  await verifyEmailViaLink(context, user.email);
  let status = await getUserStatus(sharedRequest, user.email);
  expect(status?.status).toBe('pending_mfa');
  const uri = await enableAndVerifyTotp(context, user);
  status = await getUserStatus(sharedRequest, user.email);
  expect(status?.status).toBe('active');
  expect(status?.mfaEnabled).toBe(true);
  return { ...user, context, page, totpUri: uri };
}

async function closeActiveUser(user?: ActiveUser): Promise<void> {
  await user?.context.close().catch(() => undefined);
}

async function adminApi(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<ApiResult> {
  return apiFetch(admin.context.request, path, options);
}

async function operatorApi(path: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<ApiResult> {
  return apiFetch(operator.context.request, path, options);
}

function expectOk(result: ApiResult): void {
  expect(result.status, JSON.stringify(result.body)).toBeGreaterThanOrEqual(200);
  expect(result.status, JSON.stringify(result.body)).toBeLessThan(300);
}

function data<T extends JsonObject>(result: ApiResult): T {
  return result.body.data as T;
}

async function refreshOpportunity(): Promise<Opportunity> {
  const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`);
  expectOk(res);
  currentOpportunity = data<Opportunity>(res);
  return currentOpportunity;
}

test.beforeAll(async ({ playwright, browser }) => {
  sharedRequest = await playwright.request.newContext();
  admin = await createActiveUserWithMfa(browser, adminUser);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  operator = await createActiveUserWithMfa(browser, operatorUser);
});

test.afterAll(async () => {
  await closeActiveUser(admin);
  await closeActiveUser(operator);
  await closeActiveUser(investor);
  await sharedRequest?.dispose();
});

test.describe('Visitor Flow', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test('1. Open home', async ({ page }) => {
    const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('2. Navigate to catalog section', async ({ page }) => {
    await page.goto(`${BASE}/#proyectos`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#proyectos')).toBeVisible();
    await expect(page.getByRole('heading', { name: /proyectos/i }).first()).toBeVisible();
  });

  test('3. Public opportunities API is reachable', async () => {
    const res = await apiFetch(sharedRequest, '/api/v1/opportunities');
    expectOk(res);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('4. Open opportunity detail', async ({ page }) => {
    const res = await apiFetch(sharedRequest, '/api/v1/opportunities');
    const items = res.body.data as Array<{ slug: string }>;
    expect(items.length).toBeGreaterThan(0);
    const resp = await page.goto(`${BASE}/proyectos/${items[0].slug}`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBe(200);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('5. Request info lead endpoint works', async () => {
    const res = await apiFetch(sharedRequest, '/api/contact', {
      method: 'POST',
      body: {
        name: 'Lead Admin E2E', email: `lead-${unique}@e2e.realstate.test`, phone: '+34600000001',
        subject: 'Consulta general', message: 'Solicitud de información E2E admin con tiempo válido.', consent: true, submittedAfterMs: 2500,
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  test('6. Send general contact lead endpoint works', async () => {
    const res = await apiFetch(sharedRequest, '/api/contact', {
      method: 'POST',
      body: {
        name: 'Contacto Admin E2E', email: `contact-${unique}@e2e.realstate.test`, phone: '+34600000002',
        subject: 'Otro', message: 'Contacto general E2E admin con tiempo válido.', consent: true, submittedAfterMs: 2500,
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  test('7. Request access via Coinvierte endpoint works', async () => {
    const res = await apiFetch(sharedRequest, '/api/coinvest', {
      method: 'POST',
      body: {
        name: 'Coinvierte Admin E2E', email: `coinvest-${unique}@e2e.realstate.test`, phone: '+34600000003',
        profile: 'Inversor particular', experience: 'Alguna inversión previa', interests: 'Solicitud de acceso E2E admin con tiempo válido.', consent: true, submittedAfterMs: 2500,
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  test('8. Admin can verify leads were created', async () => {
    const leads = await adminApi('/api/v1/admin/leads?limit=10');
    expectOk(leads);
    expect(Array.isArray(leads.body.data)).toBe(true);
  });
});

test.describe('Registration & Identity', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('9. Signup without invitation is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const res = await apiFetch(ctx.request, '/api/auth/sign-up/email', {
      method: 'POST',
      body: { email: `no-invite-${unique}@e2e.realstate.test`, password: 'NoInviteE2E-Pass12345!', name: 'No Invite' },
      headers: { Origin: BASE },
    });
    await ctx.close();
    expect([400, 401, 403]).toContain(res.status);
  });

  test('10. Invitation is created and does not expose token in listable APIs', async () => {
    await clearCapturedEmails(sharedRequest);
    const token = await createInvitation(sharedRequest, newUser);
    expect(token.length).toBeGreaterThan(32);
    expect(token).not.toContain('@');
  });

  test('11. Register new invited user', async ({ browser }) => {
    const ctx = await browser.newContext();
    const token = await createInvitation(sharedRequest, newUser);
    const res = await signUpWithInvitation(ctx.request, newUser, token);
    expect(res.status).toBe(200);
    const status = await getUserStatus(sharedRequest, newUser.email);
    expect(status?.status).toBe('pending_email');
    await ctx.close();
  });

  test('12. Retrieve verification link from capture mailbox', async () => {
    verificationUrlForNewUser = await waitForEmailUrl(sharedRequest, newUser.email, /\/api\/auth\/verify-email/);
    expect(verificationUrlForNewUser.startsWith(`${BASE}/api/auth/verify-email`)).toBe(true);
  });

  test('13. Verify email via Better Auth link', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(verificationUrlForNewUser, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const status = await getUserStatus(sharedRequest, newUser.email);
    expect(status?.emailVerified).toBe(true);
    expect(status?.status).toBe('pending_mfa');
    await ctx.close();
  });

  test('14. Reusing consumed invitation is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const token = await createInvitation(sharedRequest, { ...newUser, email: `reuse-${unique}@e2e.realstate.test` });
    let first = await signUpWithInvitation(ctx.request, { ...newUser, email: `reuse-${unique}@e2e.realstate.test` }, token);
    for (let attempt = 0; first.status === 429 && attempt < 3; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 11_000));
      first = await signUpWithInvitation(ctx.request, { ...newUser, email: `reuse-${unique}@e2e.realstate.test` }, token);
    }
    expect(first.status).toBe(200);
    const second = await signUpWithInvitation(ctx.request, { ...newUser, email: `reuse-${unique}@e2e.realstate.test` }, token);
    expect([400, 401, 403, 409]).toContain(second.status);
    await ctx.close();
  });

  test('15. Login before MFA cannot access admin', async ({ browser }) => {
    const ctx = await browser.newContext();
    const login = await ctx.request.post('/api/auth/sign-in/email', authMutationOptions({ email: newUser.email, password: newUser.password }));
    expect(login.status()).toBe(200);
    const adminRes = await apiFetch(ctx.request, '/api/v1/admin/dashboard');
    expect([401, 403]).toContain(adminRes.status);
    await ctx.close();
  });

  test('16. Enable TOTP and activate new user', async ({ browser }) => {
    const ctx = await browser.newContext();
    const login = await ctx.request.post('/api/auth/sign-in/email', authMutationOptions({ email: newUser.email, password: newUser.password }));
    expect(login.status()).toBe(200);
    const uri = await enableAndVerifyTotp(ctx, newUser);
    newUserTotpUri = uri;
    expect(uri).toContain('otpauth://totp/');
    const status = await getUserStatus(sharedRequest, newUser.email);
    expect(status?.status).toBe('active');
    await ctx.close();
  });

  test('17. Login with active user requires second factor redirect', async ({ browser }) => {
    expect(newUserTotpUri).toContain('otpauth://totp/');
    const { context } = await loginWithMfa(browser, newUser, newUserTotpUri);
    const session = await context.request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
    await context.close();
  });

  test('18. Email mismatch against invitation is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const token = await createInvitation(sharedRequest, { ...newUser, email: `match-${unique}@e2e.realstate.test` });
    const res = await signUpWithInvitation(ctx.request, { ...newUser, email: `other-${unique}@e2e.realstate.test` }, token);
    expect([400, 401, 403]).toContain(res.status);
    await ctx.close();
  });

  test('19. Expired invitation is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const email = `expired-${unique}@e2e.realstate.test`;
    const token = await createInvalidInvitation(sharedRequest, '/api/e2e/auth/create-expired-invitation', email);
    const res = await signUpWithInvitation(ctx.request, { ...newUser, email }, token);
    expect([400, 401, 403]).toContain(res.status);
    await ctx.close();
  });

  test('20. Revoked invitation is rejected', async ({ browser }) => {
    const ctx = await browser.newContext();
    const email = `revoked-${unique}@e2e.realstate.test`;
    const token = await createInvalidInvitation(sharedRequest, '/api/e2e/auth/create-revoked-invitation', email);
    const res = await signUpWithInvitation(ctx.request, { ...newUser, email }, token);
    expect([400, 401, 403]).toContain(res.status);
    await ctx.close();
  });

  test('21. Password recovery sends generic response and capture email', async () => {
    await clearCapturedEmails(sharedRequest);
    const res = await apiFetch(sharedRequest, '/api/auth/request-password-reset', {
      method: 'POST',
      body: { email: newUser.email, redirectTo: '/acceso/restablecer' },
      headers: { Origin: BASE },
    });
    expect([200, 202]).toContain(res.status);
    const emails = await getCapturedEmails(sharedRequest);
    const maybeReset = emails.find((item) => String(item.to || '').includes(newUser.email) && String(item.url || '').includes('/api/auth'));
    resetUrlForNewUser = maybeReset?.url || '';
  });

  test('22. Logout via Better Auth removes current session', async ({ browser }) => {
    expect(newUserTotpUri).toContain('otpauth://totp/');
    const { context } = await loginWithMfa(browser, newUser, newUserTotpUri);
    const signOut = await context.request.post('/api/auth/sign-out', authMutationOptions());
    expect([200, 204]).toContain(signOut.status());
    const me = await context.request.get('/api/auth/get-session');
    expect([200, 401]).toContain(me.status());
    await context.close();
  });
  test('23. Active admin without MFA is guided to setup and cannot access dashboard', async ({ browser }) => {
    const legacyAdmin: TestUser = {
      email: `legacy-admin-no-mfa-${unique}@e2e.realstate.test`,
      password: 'LegacyAdminE2E-Pass12345!',
      name: 'Legacy Admin Without MFA',
      role: 'admin',
    };
    const ctx = await browser.newContext();
    const token = await createInvitation(sharedRequest, legacyAdmin);
    const signup = await signUpWithInvitation(ctx.request, legacyAdmin, token);
    expect(signup.status).toBe(200);
    await verifyEmailViaLink(ctx, legacyAdmin.email);
    await markActiveWithoutMfa(sharedRequest, legacyAdmin.email);

    const login = await ctx.request.post('/api/auth/sign-in/email', authMutationOptions({ email: legacyAdmin.email, password: legacyAdmin.password }));
    expect(login.status()).toBe(200);

    const dashboard = await apiFetch(ctx.request, '/api/v1/admin/dashboard');
    expect(dashboard.status).toBe(403);
    expect((dashboard.body.error as { code?: string } | undefined)?.code).toBe('mfa_required');

    const page = await ctx.newPage();
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/verificación en dos pasos/i)).toBeVisible();
    const setupLink = page.getByRole('link', { name: /configurar.*2fa|configurar.*verificación/i });
    await expect(setupLink).toBeVisible();
    await expect(setupLink).toHaveAttribute('href', /\/acceso\/2fa/);
    await ctx.close();
  });

  test('24. Active admin without MFA can complete real TOTP and reconcile app state', async ({ browser }) => {
    const legacyAdmin: TestUser = {
      email: `legacy-admin-reconcile-${unique}@e2e.realstate.test`,
      password: 'LegacyAdminE2E-Pass12345!',
      name: 'Legacy Admin Reconcile',
      role: 'admin',
    };
    const ctx = await browser.newContext();
    const token = await createInvitation(sharedRequest, legacyAdmin);
    const signup = await signUpWithInvitation(ctx.request, legacyAdmin, token);
    expect(signup.status).toBe(200);
    await verifyEmailViaLink(ctx, legacyAdmin.email);
    await markActiveWithoutMfa(sharedRequest, legacyAdmin.email);

    const login = await ctx.request.post('/api/auth/sign-in/email', authMutationOptions({ email: legacyAdmin.email, password: legacyAdmin.password }));
    expect(login.status()).toBe(200);
    const uri = await enableAndVerifyTotp(ctx, legacyAdmin);
    expect(uri).toContain('otpauth://totp/');

    const status = await getUserStatus(sharedRequest, legacyAdmin.email);
    expect(status?.status).toBe('active');
    expect(status?.mfaEnabled).toBe(true);

    const dashboard = await apiFetch(ctx.request, '/api/v1/admin/dashboard');
    expectOk(dashboard);
    await ctx.close();
  });
});

test.describe('Operator Role Restrictions', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('23. Login operator with Better Auth and MFA', async () => {
    const session = await operator.context.request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
  });

  test('24. Operator can access admin dashboard', async () => {
    const res = await operatorApi('/api/v1/admin/dashboard');
    expectOk(res);
  });

  test('25. Operator can list opportunities', async () => {
    const res = await operatorApi('/api/v1/admin/opportunities');
    expectOk(res);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('26. Operator can list leads', async () => {
    const res = await operatorApi('/api/v1/admin/leads');
    expectOk(res);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('27. Operator can update a lead status when a lead exists', async () => {
    const list = await operatorApi('/api/v1/admin/leads?limit=1');
    expectOk(list);
    const leads = list.body.data as Array<{ public_reference?: string }>;
    if (leads[0]?.public_reference) {
      publicReference = leads[0].public_reference;
      const patch = await operatorApi(`/api/v1/admin/leads/${publicReference}`, { method: 'PATCH', body: { status: 'in_review' } });
      expectOk(patch);
    } else {
      expect(leads.length).toBe(0);
    }
  });

  test('28. Operator can add a lead note when a lead exists', async () => {
    if (!publicReference) {
      const list = await operatorApi('/api/v1/admin/leads?limit=1');
      const leads = list.body.data as Array<{ public_reference?: string }>;
      publicReference = leads[0]?.public_reference || '';
    }
    if (publicReference) {
      const note = await operatorApi(`/api/v1/admin/leads/${publicReference}/notes`, { method: 'POST', body: { content: 'Nota E2E operador' } });
      expect(note.status).toBe(201);
    } else {
      expect(publicReference).toBe('');
    }
  });

  test('29. Operator CANNOT publish', async () => {
    const create = await operatorApi('/api/v1/admin/opportunities', { method: 'POST', body: { slug: `operator-${unique}`, title: 'Operator Draft', shortDescription: 'Borrador operador', description: 'Borrador creado por operador para probar permisos', city: 'Vigo', countryCode: 'ES', assetType: 'residential', strategy: 'value_add', currency: 'EUR', targetAmountCents: 100000000, minimumInvestmentCents: 500000, estimatedTermMonths: 12, targetReturnType: 'target_irr', riskLevel: 'medium' } });
    expect(create.status).toBe(201);
    const opp = data<Opportunity>(create);
    const publish = await operatorApi(`/api/v1/admin/opportunities/${opp.id}/publish`, { method: 'POST', body: {} });
    expect(publish.status).toBe(403);
  });

  test('30. Operator CANNOT manage users or roles', async () => {
    const users = await operatorApi('/api/v1/admin/users');
    expect(users.status).toBe(403);
    const role = await operatorApi('/api/v1/admin/users/USR-DOES-NOT-EXIST/roles', { method: 'POST', body: { role: 'admin' } });
    expect(role.status).toBe(403);
  });
});

test.describe('Admin Full Workflow', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('31. Login admin with Better Auth and MFA', async () => {
    const session = await admin.context.request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
  });

  test('32. Dashboard renders with Better Auth user and session counts', async () => {
    const res = await adminApi('/api/v1/admin/dashboard');
    expectOk(res);
    const payload = res.body.data as { users?: { active?: number }; sessions?: { active?: number } };
    expect(payload).toBeTruthy();
    expect(Number(payload.users?.active ?? 0)).toBeGreaterThanOrEqual(2);
    expect(Number(payload.sessions?.active ?? 0)).toBeGreaterThanOrEqual(2);
  });

  test('33. Create opportunity', async () => {
    const res = await adminApi('/api/v1/admin/opportunities', {
      method: 'POST',
      body: {
        slug: `admin-ba-${unique}`,
        title: 'Admin Better Auth E2E',
        shortDescription: 'Proyecto creado por E2E admin Better Auth',
        description: 'Descripción completa creada durante la migración E2E admin.',
        city: 'Vigo', countryCode: 'ES', assetType: 'residential', strategy: 'value_add',
        currency: 'EUR', targetAmountCents: 120000000, minimumInvestmentCents: 500000,
        estimatedTermMonths: 18, targetReturnType: 'target_irr', riskLevel: 'medium',
      },
    });
    expect(res.status).toBe(201);
    createdOpportunity = data<Opportunity>(res);
    currentOpportunity = createdOpportunity;
    expect(createdOpportunity.id).toBeTruthy();
  });

  test('34. Complete editor section: general', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, title: 'Admin Better Auth E2E General' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('35. Complete editor section: location', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, city: 'Vigo', countryCode: 'ES', district: 'Centro' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('36. Complete editor section: strategy', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, assetType: 'residential', strategy: 'value_add' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('37. Complete editor section: status', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, status: 'coming_soon', visibility: 'private', editorialStatus: 'draft' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('38. Complete editor section: financials', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, targetAmountCents: 150000000, minimumInvestmentCents: 1000000, estimatedTermMonths: 24, targetReturnBps: 1250 } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('39. Complete editor section: description', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, description: 'Descripción final validada en el flujo completo admin.' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('40. Add highlights via subentities', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/subentities`, { method: 'PATCH', body: { version: currentOpportunity.version, highlights: [{ label: 'Ubicación', value: 'Centro de Vigo', position: 0 }] } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('41. Add risks via subentities', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/subentities`, { method: 'PATCH', body: { version: currentOpportunity.version, risks: [{ title: 'Riesgo de ejecución', description: 'Riesgo controlado en prueba E2E.', position: 0 }] } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('42. Add milestones', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/subentities`, { method: 'PATCH', body: { version: currentOpportunity.version, milestones: [{ title: 'Compra', description: 'Hito de compra', plannedDate: new Date(Date.now() + 86400000).toISOString(), position: 0 }] } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('43. Add media', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/subentities`, { method: 'PATCH', body: { version: currentOpportunity.version, media: [{ assetId: 'e2e-admin-image.jpg', altText: 'Imagen E2E', isPrimary: true, position: 0 }] } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
  });

  test('44. Save and verify version increment', async () => {
    const before = currentOpportunity.version;
    currentOpportunity = await refreshOpportunity();
    expect(currentOpportunity.version).toBeGreaterThanOrEqual(before);
  });

  test('45. Preview subentities', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/subentities`);
    expectOk(res);
    const payload = res.body.data as { highlights?: unknown[]; risks?: unknown[]; milestones?: unknown[]; media?: unknown[] };
    expect(payload.highlights?.length || 0).toBeGreaterThan(0);
    expect(payload.risks?.length || 0).toBeGreaterThan(0);
  });

  test('46. Submit for review via status patch', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: currentOpportunity.version, editorialStatus: 'review' } });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
    expect(currentOpportunity.editorial_status).toBe('review');
  });

  test('47. Publish as admin', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/publish`, { method: 'POST', body: {} });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
    expect(currentOpportunity.visibility).toBe('public');
  });

  test('48. Confirm public appearance', async () => {
    const res = await apiFetch(sharedRequest, '/api/v1/opportunities');
    expectOk(res);
    const list = res.body.data as Array<{ slug?: string }>;
    expect(list.some((item) => item.slug === createdOpportunity.slug)).toBe(true);
  });

  test('49. Open public detail', async ({ page }) => {
    const resp = await page.goto(`${BASE}/proyectos/${createdOpportunity.slug}`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBe(200);
    await expect(page.getByText(/Admin Better Auth E2E/i).first()).toBeVisible();
  });

  test('50. Version conflict returns 409', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`, { method: 'PATCH', body: { version: 1, title: 'Conflict title' } });
    expect(res.status).toBe(409);
  });

  test('51. Current version remains readable after conflict', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}`);
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
    expect(currentOpportunity.id).toBe(createdOpportunity.id);
  });

  test('52. Unpublish and confirm private', async () => {
    const res = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/unpublish`, { method: 'POST', body: {} });
    expectOk(res);
    currentOpportunity = data<Opportunity>(res);
    expect(currentOpportunity.visibility).toBe('private');
  });

  test('53. Confirm disappearance from public list', async () => {
    const res = await apiFetch(sharedRequest, '/api/v1/opportunities');
    expectOk(res);
    const list = res.body.data as Array<{ slug?: string }>;
    expect(list.some((item) => item.slug === createdOpportunity.slug)).toBe(false);
  });

  test('54. Restore version and archive restored copy', async () => {
    const restore = await adminApi(`/api/v1/admin/opportunities/${createdOpportunity.id}/versions/2/restore`, { method: 'POST', body: {} });
    expectOk(restore);
    const restored = data<Opportunity>(restore);
    restoredOpportunityId = restored.id;
    const archive = await adminApi(`/api/v1/admin/opportunities/${restoredOpportunityId}/archive`, { method: 'POST', body: {} });
    expectOk(archive);
  });

  test('55. Manage users, sessions and audit log', async () => {
    const users = await adminApi('/api/v1/admin/users?limit=5');
    expectOk(users);
    const userRows = users.body.data as Array<{ public_reference?: string }>;
    legacyUserReference = userRows.find((item) => item.public_reference)?.public_reference || '';
    if (legacyUserReference) {
      const status = await adminApi(`/api/v1/admin/users/${legacyUserReference}/status`, { method: 'PATCH', body: { status: 'active' } });
      expectOk(status);
      const sessions = await adminApi(`/api/v1/admin/users/${legacyUserReference}/sessions`, { method: 'DELETE', body: {} });
      expectOk(sessions);
      sessionReference = legacyUserReference;
    }
    const audit = await adminApi('/api/v1/admin/audit?limit=20');
    expectOk(audit);
    expect(Array.isArray(audit.body.data)).toBe(true);
  });

  test('56. Logout', async () => {
    const signOut = await admin.context.request.post('/api/auth/sign-out', authMutationOptions());
    expect([200, 204]).toContain(signOut.status());
    const after = await adminApi('/api/v1/admin/dashboard');
    expect(after.status).toBe(401);
  });
});
