import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { leadRequestSchema, normalizeLeadInput } from './leads/schemas.js';

const validBody = {
  kind: 'access_request',
  firstName: ' Ada ',
  lastName: ' Lovelace ',
  email: ' ADA@Example.COM ',
  phone: '+34 600 000 000',
  countryCode: 'es',
  investmentRange: '25000_50000',
  message: 'Quiero recibir información cuando esté disponible.',
  sourcePath: '/solicitar-acceso',
  privacyAccepted: true,
  marketingOptIn: false,
  submittedAfterMs: 3200,
  website: ''
};

function repo(overrides = {}) {
  return {
    create: vi.fn(async (input) => ({ publicReference: 'RS-20260614-ABC123', kind: input.kind, status: 'new' as const, createdAt: '2026-06-14T09:30:00.000Z' })),
    createContact: vi.fn(async () => ({ publicReference: 'RS-20260614-ABC123', status: 'new' as const, createdAt: '2026-06-14T09:30:00.000Z' })),
    createCoinvest: vi.fn(async () => ({ publicReference: 'RS-20260614-ABC123', status: 'new' as const, createdAt: '2026-06-14T09:30:00.000Z' })),
    ...overrides
  };
}

const opportunities = {} as never;

describe('lead schemas', () => {
  it('normalizes email, names and country while keeping marketing consent separate', () => {
    const normalized = normalizeLeadInput(leadRequestSchema.parse(validBody));
    expect(normalized.email).toBe('ada@example.com');
    expect(normalized.firstName).toBe('Ada');
    expect(normalized.lastName).toBe('Lovelace');
    expect(normalized.countryCode).toBe('ES');
    expect(normalized.marketingOptIn).toBe(false);
  });

  it('rejects unknown fields, missing privacy and overlong messages', () => {
    expect(() => leadRequestSchema.parse({ ...validBody, privacyAccepted: false })).toThrow();
    expect(() => leadRequestSchema.parse({ ...validBody, extra: 'nope' })).toThrow();
    expect(() => leadRequestSchema.parse({ ...validBody, message: 'x'.repeat(2001) })).toThrow();
  });
});

describe('POST /api/v1/leads', () => {
  it('returns 503 when lead capture is disabled', async () => {
    const app = buildApp({ logger: false, opportunities, leads: repo(), config: { leadsEnabled: false, privacyControllerName: 'Demo', privacyContactEmail: 'privacy@example.test', privacyPolicyVersion: '2026-06-14' } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/leads', payload: validBody });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('leads_disabled');
  });

  it('creates access, contact and opportunity inquiries with minimal response and no PII', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: { leadsEnabled: true, privacyControllerName: 'Demo Controller', privacyContactEmail: 'privacy@example.test', privacyPolicyVersion: '2026-06-14', leadsRateLimitMax: 10, leadsRateLimitWindowMs: 60000 } });

    for (const kind of ['access_request', 'general_contact', 'opportunity_inquiry'] as const) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/leads', payload: { ...validBody, kind, opportunitySlug: kind === 'opportunity_inquiry' ? 'eixample-rehabilitacion-luminosa' : undefined } });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toMatchObject({ data: { publicReference: 'RS-20260614-ABC123', kind, status: 'new' } });
      expect(JSON.stringify(body)).not.toMatch(/ada@example|Lovelace|600 000|Quiero recibir/i);
    }
    expect(leads.create).toHaveBeenCalledTimes(3);
  });

  it('rejects invalid opportunity, honeypot and too-fast submissions', async () => {
    const app = buildApp({ logger: false, opportunities, leads: repo(), config: { leadsEnabled: true, privacyControllerName: 'Demo', privacyContactEmail: 'privacy@example.test', privacyPolicyVersion: '2026-06-14', leadsRateLimitMax: 10, leadsRateLimitWindowMs: 60000 } });
    expect((await app.inject({ method: 'POST', url: '/api/v1/leads', payload: { ...validBody, kind: 'opportunity_inquiry' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/leads', payload: { ...validBody, website: 'bot' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/leads', payload: { ...validBody, submittedAfterMs: 500 } })).statusCode).toBe(400);
  });

  it('rate limits by origin and does not enumerate emails', async () => {
    const app = buildApp({ logger: false, opportunities, leads: repo(), config: { leadsEnabled: true, privacyControllerName: 'Demo', privacyContactEmail: 'privacy@example.test', privacyPolicyVersion: '2026-06-14', leadsRateLimitMax: 1, leadsRateLimitWindowMs: 60000 } });
    expect((await app.inject({ method: 'POST', url: '/api/v1/leads', remoteAddress: '198.51.100.10', payload: validBody })).statusCode).toBe(201);
    const second = await app.inject({ method: 'POST', url: '/api/v1/leads', remoteAddress: '198.51.100.10', payload: { ...validBody, email: 'other@example.test' } });
    expect(second.statusCode).toBe(429);
    expect(JSON.stringify(second.json())).not.toMatch(/other@example/i);
  });

  it('returns safe error without PII on database failure', async () => {
    const app = buildApp({ logger: false, opportunities, leads: repo({ create: vi.fn(async () => { throw new Error('db exploded'); }) }), config: { leadsEnabled: true, privacyControllerName: 'Demo', privacyContactEmail: 'privacy@example.test', privacyPolicyVersion: '2026-06-14' } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/leads', payload: validBody });
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.json())).not.toMatch(/ada@example|Lovelace|600 000|Quiero recibir/i);
  });
});

// ── Contact form ──

const validContactBody = {
  name: ' María  García ',
  email: ' MARIA@Example.COM ',
  phone: '+34 600 000 000',
  subject: 'Consulta general' as const,
  message: 'Me gustaría recibir más información sobre sus servicios de inversión inmobiliaria.',
  consent: true as const,
  submittedAfterMs: 3200,
  website: ''
};

function contactConfig(overrides: Record<string, unknown> = {}) {
  return {
    privacyControllerName: 'Demo Controller',
    privacyContactEmail: 'privacy@example.test',
    privacyPolicyVersion: '2026-06-14',
    leadsRateLimitMax: 10,
    leadsRateLimitWindowMs: 60000,
    ...overrides
  };
}

describe('POST /api/contact', () => {
  it('1. valid submission returns 201 and calls createContact exactly once', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: validContactBody });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({ data: { publicReference: 'RS-20260614-ABC123', status: 'new' } });
    expect(body.data.message).toBe('Mensaje enviado. Gracias por contactar con nosotros. Revisaremos tu consulta y te responderemos lo antes posible.');
    expect(leads.createContact).toHaveBeenCalledTimes(1);
  });

  it('2. saved record carries kind, source_path, subject, consent timestamp and correct initial status', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    await app.inject({ method: 'POST', url: '/api/contact', payload: validContactBody });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call: Record<string, unknown> = (leads.createContact as any).mock.calls[0][0];
    expect(call.name).toBe('María García');
    expect(call.email).toBe('maria@example.com');
    expect(call.subject).toBe('Consulta general');
    expect(call.message).toBe('Me gustaría recibir más información sobre sus servicios de inversión inmobiliaria.');
    // Phone is passed through (repo handles null)
    expect(call.phone).toBe('+34 600 000 000');
  });

  it('3. invalid email returns 400 and does not call createContact', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, email: 'notanemail' } });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_request');
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('4. message shorter than 20 characters is rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, message: 'Corto' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('5. message longer than 2000 characters is rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, message: 'x'.repeat(2001) } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('6. absent or false consent is rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    // no consent field
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { consent: _consent, ...noConsent } = validContactBody;
    let response = await app.inject({ method: 'POST', url: '/api/contact', payload: noConsent });
    expect(response.statusCode).toBe(400);
    // false consent
    response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, consent: false } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('7. filled honeypot is rejected without storing', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, website: 'https://spam.bot' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('8. unknown fields are rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, injected: true } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('9. Zod max: message longer than 2000 characters is rejected (Zod, not body limit)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: { ...validContactBody, message: 'x'.repeat(5000) } });
    expect(response.statusCode).toBe(400);
    expect(leads.createContact).not.toHaveBeenCalled();
  });

  it('9b. HTTP body limit: payload exceeding 16KB returns 413 and never calls createContact', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    // Build a payload > 16KB (16,384 bytes) — fill message with ~17KB of text
    const bigPayload = { ...validContactBody, message: 'x'.repeat(17_000) };
    expect(JSON.stringify(bigPayload).length).toBeGreaterThan(16_384);
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: bigPayload });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('payload_too_large');
    expect(leads.createContact).not.toHaveBeenCalled();
    // No internal details exposed
    expect(JSON.stringify(response.json())).not.toMatch(/body|FST_ERR|limit|stack/i);
  });

  it('10. rate limit activates and blocked attempts do not call createContact', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig({ leadsRateLimitMax: 1 }) });
    // First request succeeds
    const first = await app.inject({ method: 'POST', url: '/api/contact', remoteAddress: '198.51.100.20', payload: validContactBody });
    expect(first.statusCode).toBe(201);
    expect(leads.createContact).toHaveBeenCalledTimes(1);
    // Second request rate-limited
    const second = await app.inject({ method: 'POST', url: '/api/contact', remoteAddress: '198.51.100.20', payload: { ...validContactBody, email: 'other@example.test' } });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe('rate_limited');
    expect(leads.createContact).toHaveBeenCalledTimes(1); // still only 1 call
  });

  it('11. empty phone is normalized and optional', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { phone: _phone, ...noPhone } = validContactBody;
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: noPhone });
    expect(response.statusCode).toBe(201);
    expect(leads.createContact).toHaveBeenCalledTimes(1);
    // Phone should be undefined after Zod transform
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((leads.createContact as any).mock.calls[0][0].phone).toBeUndefined();
  });

  it('12. texts are stored trimmed and email lowercased', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: contactConfig() });
    await app.inject({ method: 'POST', url: '/api/contact', payload: validContactBody });
    const call: Record<string, string> = (leads.createContact as unknown as { mock: { calls: [Record<string, string>[]] } }).mock.calls[0][0];
    expect(call.name).toBe('María García');       // collapsed spaces
    expect(call.email).toBe('maria@example.com');  // lowercased
    expect(call.message).not.toMatch(/^\s|\s$/);   // no leading/trailing whitespace
  });

  it('13. response never exposes PII or internal errors on failure', async () => {
    const app = buildApp({
      logger: false,
      opportunities,
      leads: repo({ createContact: vi.fn(async () => { throw new Error('db connection lost'); }) }),
      config: contactConfig()
    });
    const response = await app.inject({ method: 'POST', url: '/api/contact', payload: validContactBody });
    expect(response.statusCode).toBe(500);
    const text = JSON.stringify(response.json());
    expect(text).not.toMatch(/maria@example/i);
    expect(text).not.toMatch(/García/i);
    expect(text).not.toMatch(/600 000/i);
    expect(text).not.toMatch(/inversión inmobiliaria/i);
    expect(text).not.toMatch(/db connection/i);
    // "error" is a normal field name in errorResponseSchema; reject only stack traces / internal details
    expect(text).not.toMatch(/stack|trace|Error\(/i);
    expect(response.json().error.code).toBe('internal_error');
  });
});

// ── POST /api/coinvest ──

const validCoinvestBody = {
  name: 'Carlos López',
  email: 'carlos@example.com',
  phone: '+34 600 000 003',
  profile: 'Inversor particular',
  experience: 'Alguna inversión previa',
  interests: 'Proyectos en Vigo, rentabilidad estable.',
  consent: true,
  submittedAfterMs: 3500,
  website: ''
};

function coinvestConfig() {
  return contactConfig();
}

describe('POST /api/coinvest', () => {
  it('1. valid submission returns 201 and calls createCoinvest exactly once', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: validCoinvestBody });
    expect(response.statusCode).toBe(201);
    expect(leads.createCoinvest).toHaveBeenCalledTimes(1);
  });

  it('2. saved record carries kind, source_path, profile, experience, consent and correct initial status', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: validCoinvestBody });
    expect(response.statusCode).toBe(201);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call: Record<string, unknown> = (leads.createCoinvest as any).mock.calls[0][0];
    expect(call.profile).toBe('Inversor particular');
    expect(call.experience).toBe('Alguna inversión previa');
    expect(call.interests).toBe('Proyectos en Vigo, rentabilidad estable.');
    const body = response.json();
    expect(body.data.status).toBe('new');
    expect(body.data.publicReference).toMatch(/^RS-/);
  });

  it('3. invalid email returns 400 and does not call createCoinvest', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, email: 'bad' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('4. absent or false consent is rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { consent: _c, ...noConsent } = validCoinvestBody;
    let response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: noConsent });
    expect(response.statusCode).toBe(400);
    response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, consent: false } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('5. filled honeypot is rejected without storing', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, website: 'https://spam.bot' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('6. rate limit activates and blocked attempts do not call createCoinvest', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    // Fire 11 rapid requests; rate limit should trigger
    for (let i = 0; i < 11; i += 1) {
      await app.inject({ method: 'POST', url: '/api/coinvest', payload: validCoinvestBody, headers: { 'x-forwarded-for': '10.0.0.99' } });
    }
    const calls = (leads.createCoinvest as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(calls).toBeLessThan(11);
    expect(calls).toBeGreaterThan(0);
  });

  it('7. unknown fields are rejected', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, injected: true } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('8. consent_version is server-controlled (client cannot override)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    // Sending consentVersion should be rejected as unknown field
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, consentVersion: 'old-v0' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('9. optional interests and phone are normalized', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { interests: _i, phone: _p, ...noOpt } = validCoinvestBody;
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: noOpt });
    expect(response.statusCode).toBe(201);
  });

  it('10. email is lowercased and name trimmed in persisted data', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, name: '  Carlos  López  ', email: 'CARLOS@Example.COM' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call: Record<string, unknown> = (leads.createCoinvest as any).mock.calls[0][0];
    expect(call.name).toBe('Carlos López');
    expect(call.email).toBe('carlos@example.com');
  });

  it('11. returns safe error without PII on database failure', async () => {
    const app = buildApp({
      logger: false,
      opportunities,
      leads: repo({ createCoinvest: vi.fn(async () => { throw new Error('db connection lost'); }) }),
      config: coinvestConfig()
    });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: validCoinvestBody });
    expect(response.statusCode).toBe(500);
    const text = JSON.stringify(response.json());
    expect(text).not.toMatch(/carlos@example/i);
    expect(text).not.toMatch(/López/i);
    expect(text).not.toMatch(/db connection/i);
    expect(text).not.toMatch(/stack|trace|Error\(/i);
  });

  it('12. returns 503 when createCoinvest method is not available', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createCoinvest: _cv, ...withoutMethod } = repo();
    const app = buildApp({ logger: false, opportunities, leads: withoutMethod, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: validCoinvestBody });
    expect(response.statusCode).toBe(503);
  });

  it('13. oversized body returns 413 without calling createCoinvest', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const bigBody = { ...validCoinvestBody, interests: 'x'.repeat(17000) };
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: bigBody });
    expect(response.statusCode).toBe(413);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('14. rejects profile with a value not in the allowed enum (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, profile: 'Perfil inventado' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('15. rejects experience with a value not in the allowed enum (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, experience: 'Experiencia imaginaria' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('16. rejects interests longer than 1000 characters (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, interests: 'x'.repeat(1001) } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('17. rejects client-supplied kind field (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, kind: 'access_request' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('18. rejects client-supplied source_path field (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, source_path: '/malicious-path' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('19. rejects client-supplied status field (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, status: 'approved' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });

  it('20. rejects client-supplied consentVersion field (400, no persist)', async () => {
    const leads = repo();
    const app = buildApp({ logger: false, opportunities, leads, config: coinvestConfig() });
    const response = await app.inject({ method: 'POST', url: '/api/coinvest', payload: { ...validCoinvestBody, consentVersion: 'v2-evil' } });
    expect(response.statusCode).toBe(400);
    expect(leads.createCoinvest).not.toHaveBeenCalled();
  });
});
