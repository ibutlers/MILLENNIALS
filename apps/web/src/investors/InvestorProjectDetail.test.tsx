import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { InvestorProjectDetail } from './InvestorProjectDetail';

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/inversores/proyectos/plaza-america']}>
      <Routes>
        <Route path="/inversores/proyectos/:slug" element={<InvestorProjectDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InvestorProjectDetail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a project by slug from the private investor route and shows private investor metrics', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/investor/projects/plaza-america') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'opp-1',
              slug: 'plaza-america',
              title: 'Promoción Plaza América',
              short_description: 'Resumen privado.',
              description: 'Detalle privado autorizado.',
              city: 'Vigo',
              status: 'in_execution',
              risk_level: 'medium',
              target_return_type: 'target_annual_return',
              target_return_bps: 700,
              target_amount_cents: 80000000,
              committed_amount_cents: 80000000,
              estimated_term_months: 36,
              investor_committed_amount_cents: 2500000,
              investor_currency: 'EUR',
              investor_notes: 'Nota privada del equipo.',
            },
          }),
        };
      }
      if (url === '/api/investor/projects/plaza-america/documents') {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: { message: 'unexpected endpoint' } }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderDetail();

    expect(await screen.findByRole('heading', { name: /promoción plaza américa/i })).toBeInTheDocument();
    expect(screen.getByText(/detalle privado autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/capital asignado/i)).toBeInTheDocument();
    expect(screen.getByText(/25.000/i)).toBeInTheDocument();
    expect(screen.getByText(/nota privada del equipo/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/investor/projects/plaza-america', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('/api/investor/projects/plaza-america/documents', expect.anything());
  });
});
