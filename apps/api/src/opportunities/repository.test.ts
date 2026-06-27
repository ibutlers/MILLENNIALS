import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { OpportunityRepository } from './repository.js';

function opportunityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    slug: 'plaza-america',
    title: 'Promoción Plaza América',
    short_description: 'Ficha pública sintética.',
    description: 'Descripción pública completa.',
    city: 'Vigo',
    country_code: 'ES',
    district: 'Plaza América',
    asset_type: 'Residencial',
    strategy: 'Promoción residencial',
    status: 'in_execution',
    currency: 'EUR',
    target_amount_cents: '80000000',
    committed_amount_cents: '80000000',
    project_total_amount_cents: '250000000',
    bank_financing_amount_cents: '170000000',
    minimum_investment_cents: '500000',
    estimated_term_months: 36,
    target_return_type: 'target_annual_return',
    target_return_bps: 700,
    risk_level: 'medium',
    closing_date: null,
    published_at: new Date('2026-06-16T08:00:00.000Z'),
    total_count: '1',
    type: 'image',
    url: '/images/plaza-america.jpg',
    alt_text: 'Fachada Plaza América',
    position: 0,
    ...overrides,
  };
}

describe('OpportunityRepository public DTO', () => {
  it('lists only editorially published public projects and omits raw/admin fields from the home DTO', async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [opportunityRow()] })),
    };
    const repository = new OpportunityRepository(pool as unknown as Pool);

    const result = await repository.list({ limit: 3, offset: 0, sort: 'publishedAt', direction: 'desc' });

    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("o.visibility = $1");
    expect(sql).toContain("o.editorial_status = 'published'");
    expect(sql).toContain('o.published_at IS NOT NULL');
    expect(params[0]).toBe('public');

    const item = result.data[0] as Record<string, unknown>;
    expect(item.publicReturnDisplay).toBe('21% +50%*');
    expect(item.fundingProgress).toBe(100);
    expect(item.projectTotalAmount).toMatchObject({ formatted: '2.500.000 €' });
    expect(item).not.toHaveProperty('targetAmount');
    expect(item).not.toHaveProperty('committedAmount');
    expect(item).not.toHaveProperty('riskLevel');
    expect(item).not.toHaveProperty('closingDate');
    expect(item).not.toHaveProperty('publishedAt');
    expect(item).not.toHaveProperty('targetReturnType');
  });

  it('returns public detail metrics without exposing editorial/admin-only fields', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [opportunityRow()] })
        .mockResolvedValueOnce({ rows: [{ type: 'image', url: '/images/plaza-america.jpg', alt_text: 'Fachada Plaza América', position: 0 }] })
        .mockResolvedValueOnce({ rows: [{ label: 'Financiación', value: '800.000€ cubiertos · 100%', position: 0 }] })
        .mockResolvedValueOnce({ rows: [{ title: 'Riesgo licencia', description: 'Seguimiento de tramitación.', position: 0 }] })
        .mockResolvedValueOnce({ rows: [{ title: 'Financiación cerrada', description: 'Capital cubierto.', planned_date: '2026-03-01', completed_at: '2026-03-01T10:00:00.000Z', position: 0 }] }),
    };
    const repository = new OpportunityRepository(pool as unknown as Pool);

    const result = await repository.findBySlug('plaza-america');

    const [sql, params] = pool.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("visibility = 'public'");
    expect(sql).toContain("editorial_status = 'published'");
    expect(sql).toContain('published_at IS NOT NULL');
    expect(params).toEqual(['plaza-america']);

    expect(result).not.toBeNull();
    const data = result!.data as Record<string, unknown>;
    expect(data.publicCommittedAmount).toMatchObject({ formatted: '800.000 €' });
    expect(data.bankFinancingAmount).toMatchObject({ formatted: '1.700.000 €' });
    expect(data.closingDate).toBeNull();
    expect(data.publicReturnDisplay).toBe('21% +50%*');
    expect(data).not.toHaveProperty('targetAmount');
    expect(data).not.toHaveProperty('committedAmount');
    expect(data).not.toHaveProperty('riskLevel');
    expect(data).not.toHaveProperty('publishedAt');
    expect(data).not.toHaveProperty('targetReturnType');
  });
});
