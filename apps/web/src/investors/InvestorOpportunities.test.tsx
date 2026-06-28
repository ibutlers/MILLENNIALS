import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { InvestorOpportunities } from './InvestorOpportunities';

const investorOpportunitiesResponse = {
  data: [
    {
      slug: 'plaza-america',
      title: 'Promoción Plaza América',
      shortDescription: 'Proyecto público con acciones privadas para inversores.',
      city: 'Vigo',
      countryCode: 'ES',
      district: 'Plaza América',
      assetType: 'Residencial',
      strategy: 'Promoción residencial',
      status: 'open',
      currency: 'EUR',
      publicInvestmentAmount: { cents: 80000000, currency: 'EUR', formatted: '800.000 €' },
      projectTotalAmount: { cents: 250000000, currency: 'EUR', formatted: '2.500.000 €' },
      minimumInvestment: { cents: 500000, currency: 'EUR', formatted: '5000 €' },
      estimatedTermMonths: 36,
      publicReturnDisplay: '21% +50%*',
      fundingProgress: 100,
      primaryImage: { type: 'image', url: '/images/plaza-america.jpg', altText: 'Fachada Plaza América', position: 0 },
      investorAccess: {
        status: 'active',
        committedAmount: { cents: 2500000, currency: 'EUR', formatted: '25.000 €' },
        notes: 'Acceso concedido',
      },
      investmentRequests: [
        { public_reference: 'IR-TEST', status: 'requested', opportunity_slug: 'plaza-america', requested_amount_cents: 2500000, approved_amount_cents: null, transfer_reference: null },
      ],
    },
  ],
};

describe('InvestorOpportunities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the authenticated investor opportunities endpoint and labels the screen as public catalog with private actions', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/investor/opportunities') return { ok: true, json: async () => investorOpportunitiesResponse };
      if (url === '/api/investor/investment-requests') return { ok: true, json: async () => ({ data: investorOpportunitiesResponse.data[0].investmentRequests }) };
      return { ok: false, json: async () => ({ error: { message: 'unexpected endpoint' } }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MemoryRouter><InvestorOpportunities /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: /catálogo público con acciones privadas/i })).toBeInTheDocument();
    expect(screen.getByText(/la información de proyecto visible aquí es pública/i)).toBeInTheDocument();
    expect(screen.getByText('Promoción Plaza América')).toBeInTheDocument();
    const card = screen.getByRole('article', { name: /promoción plaza américa/i });
    expect(within(card).getByText(/inversión:/i)).toHaveTextContent('800.000');
    expect(within(card).queryByText(/inversión total/i)).not.toBeInTheDocument();
    expect(screen.getByText(/capital asignado:/i)).toHaveTextContent('25.000');
    expect(within(card).getByRole('link', { name: /ver detalle privado/i })).toHaveAttribute('href', '/inversores/proyectos/plaza-america');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/investor/opportunities', expect.objectContaining({ headers: { Accept: 'application/json' } })));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/v1/opportunities'), expect.anything());
  });
});
