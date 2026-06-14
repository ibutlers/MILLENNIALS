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
