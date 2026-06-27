import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { DEMO_OPPORTUNITY_DISCLAIMER } from './db/seed.js';

const summary = {
  slug: 'eixample-rehabilitacion-luminosa',
  title: 'Rehabilitación luminosa en Eixample',
  shortDescription: 'Activo demo público',
  city: 'Barcelona',
  countryCode: 'ES',
  district: 'Eixample',
  assetType: 'Residencial urbano',
  strategy: 'Rehabilitación energética',
  status: 'funding',
  currency: 'EUR',
  projectTotalAmount: { cents: 68000000, currency: 'EUR', formatted: '680.000 €' },
  minimumInvestment: { cents: 1500000, currency: 'EUR', formatted: '15.000 €' },
  estimatedTermMonths: 18,
  publicReturnDisplay: '12,3% +50%*',
  fundingProgress: 42.4,
  primaryImage: { type: 'image', url: '/images/opportunity-rehabilitacion.webp', altText: 'Imagen demo', position: 0 },
  disclaimer: DEMO_OPPORTUNITY_DISCLAIMER
} as const;

function appWithRepository(overrides: Partial<{ list: unknown; findBySlug: unknown }> = {}) {
  const repo = {
    list: async () => ({
      data: [summary],
      pagination: { limit: 12, offset: 0, total: 1, hasMore: false },
      meta: { disclaimer: DEMO_OPPORTUNITY_DISCLAIMER, allowedSorts: ['publishedAt'] }
    }),
    findBySlug: async (slug: string) =>
      slug === summary.slug
        ? {
            data: {
              ...summary,
              publicCommittedAmount: { cents: 53000000, currency: 'EUR', formatted: '530.000 €' },
              bankFinancingAmount: { cents: 15000000, currency: 'EUR', formatted: '150.000 €' },
              closingDate: '2026-10-15',
              description: 'Descripción pública',
              highlights: [{ label: 'Uso', value: 'Residencial', position: 0 }],
              risks: [{ title: 'Riesgo de obra', description: 'Puede variar el calendario.', position: 0 }],
              milestones: [{ title: 'Due diligence', description: 'Revisión técnica.', plannedDate: '2026-07-01', completedAt: null, position: 0 }],
              media: [summary.primaryImage]
            },
            meta: { disclaimer: DEMO_OPPORTUNITY_DISCLAIMER }
          }
        : null,
    ...overrides
  };
  return buildApp({ logger: false, opportunities: repo as never, pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) } as never });
}

describe('health routes', () => {
  it('returns liveness without database and API health with dependency status', async () => {
    const app = appWithRepository();
    const live = await app.inject({ method: 'GET', url: '/health' });
    const api = await app.inject({ method: 'GET', url: '/api/health' });

    expect(live.statusCode).toBe(200);
    expect(live.body).toBe('ok');
    expect(api.statusCode).toBe(200);
    expect(api.json()).toMatchObject({ status: 'ok', dependencies: { postgres: 'ok' } });
  });
});

describe('public opportunities API', () => {
  it('lists public opportunities with pagination, calculated progress and disclaimer', async () => {
    const app = appWithRepository();
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities?status=funding&limit=12&offset=0&sort=publishedAt' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [{ slug: summary.slug, fundingProgress: 42.4, disclaimer: DEMO_OPPORTUNITY_DISCLAIMER }],
      pagination: { limit: 12, offset: 0, total: 1, hasMore: false }
    });
    expect(response.body).not.toMatch(/private|draft|internal/i);
  });

  it('rejects invalid filters and unsafe arbitrary query parameters', async () => {
    const app = appWithRepository();
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities?limit=500&dropTable=true' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('returns a public opportunity detail without private documents or investors', async () => {
    const app = appWithRepository();
    const response = await app.inject({ method: 'GET', url: `/api/v1/opportunities/${summary.slug}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.highlights).toHaveLength(1);
    expect(body.data.risks[0].title).toMatch(/riesgo/i);
    expect(response.body).not.toMatch(/investor|kyc|document_private|admin/i);
  });

  it('returns 404 for missing or non-public opportunities', async () => {
    const app = appWithRepository();
    const response = await app.inject({ method: 'GET', url: '/api/v1/opportunities/no-publica' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});
