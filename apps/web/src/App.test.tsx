import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const apiResponse = {
  data: [
    {
      slug: 'eixample-rehabilitacion-luminosa',
      title: 'Rehabilitación luminosa en Eixample',
      shortDescription: 'Activo demo público servido desde PostgreSQL.',
      city: 'Barcelona',
      countryCode: 'ES',
      district: 'Eixample',
      assetType: 'Residencial urbano',
      strategy: 'Rehabilitación energética',
      status: 'funding',
      currency: 'EUR',
      targetAmount: { cents: 125000000, currency: 'EUR', formatted: '1.250.000 €' },
      committedAmount: { cents: 53000000, currency: 'EUR', formatted: '530.000 €' },
      minimumInvestment: { cents: 1500000, currency: 'EUR', formatted: '15.000 €' },
      estimatedTermMonths: 18,
      targetReturnType: 'target_annual_return',
      targetReturn: { basisPoints: 820, decimal: 0.082, formatted: '8,2%' },
      riskLevel: 'medium',
      closingDate: '2026-10-15',
      publishedAt: '2026-06-01T08:00:00.000Z',
      fundingProgress: 42.4,
      primaryImage: { type: 'image', url: '/images/opportunity-rehabilitacion.webp', altText: 'Imagen demo', position: 0 },
      disclaimer: 'Datos ilustrativos de demostración. Los objetivos no están garantizados y no constituyen una oferta de inversión.'
    }
  ],
  pagination: { limit: 3, offset: 0, total: 1, hasMore: false },
  meta: { disclaimer: 'Datos ilustrativos de demostración. Los objetivos no están garantizados y no constituyen una oferta de inversión.', allowedSorts: ['publishedAt'] }
};

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/v1/lead-settings')) {
      return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
    }
    return Promise.resolve({ ok, json: async () => body });
  }));
}

describe('MILLENNIALS CONSTRUYEN landing', () => {
  beforeEach(() => {
    mockFetch(apiResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders an institutional public landing without unverified performance claims', async () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /inversión inmobiliaria con disciplina, datos y seguimiento operativo/i
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/scaffold|entorno preparado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    await screen.findByRole('article', { name: /proyecto:/i });

    const forbiddenClaims = /capital gestionado|rentabilidad histórica|proyectos ejecutados|oficinas internacionales|propiedades analizadas al mes|retorno histórico/i;
    expect(document.body).not.toHaveTextContent(forbiddenClaims);
  });

  it('shows loading and then API-backed opportunity cards with disclaimer and financial formatting', async () => {
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(/cargando proyectos/i);
    const opportunities = await screen.findAllByRole('article', { name: /proyecto:/i });
    expect(opportunities).toHaveLength(1);

    const card = opportunities[0];
    expect(within(card).getByText(/datos ilustrativos/i)).toBeInTheDocument();
    expect(within(card).getByText(/rentabilidad anual objetivo estimada/i)).toBeInTheDocument();
    expect(within(card).getByText('8,2%')).toBeInTheDocument();
    expect(within(card).getByText(/1\\.250\\.000\\s*€/)).toBeInTheDocument();
    expect(within(card).getByText(/medio · no regulatorio/i)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /ver proyecto/i })).toHaveAttribute('href', '/proyectos/eixample-rehabilitacion-luminosa');
    expect(screen.getByText(/los objetivos no están garantizados/i)).toBeInTheDocument();
  });

  it('shows an honest error state instead of fake fallback data when the API fails', async () => {
    mockFetch({ error: { code: 'internal_error' } }, false);
    render(<App />);

    await screen.findByRole('alert');
    expect(screen.getByText(/no mostramos datos falsos como si fueran reales/i)).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /proyecto:/i })).not.toBeInTheDocument();
  });

  it('shows an empty state when the API returns no public opportunities', async () => {
    mockFetch({ ...apiResponse, data: [], pagination: { limit: 3, offset: 0, total: 0, hasMore: false } });
    render(<App />);

    await screen.findByText(/no hay proyectos públicos disponibles/i);
    expect(screen.queryByRole('article', { name: /proyecto:/i })).not.toBeInTheDocument();
  });

  it('presents corporate narrative, methodology and technology sections before opportunities', async () => {
    render(<App />);
    await screen.findByRole('article', { name: /proyecto:/i });

    const mainText = screen.getByRole('main').textContent ?? '';
    expect(mainText.indexOf('Nuestra actividad')).toBeGreaterThan(-1);
    expect(mainText.indexOf('Cómo trabajamos')).toBeGreaterThan(mainText.indexOf('Nuestra actividad'));
    expect(mainText.indexOf('Tecnología y análisis')).toBeGreaterThan(mainText.indexOf('Cómo trabajamos'));
    expect(mainText.indexOf('Proyectos destacados')).toBeGreaterThan(mainText.indexOf('Tecnología y análisis'));
    expect(screen.getAllByText(/documentación estructurada/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/actualización de avance/i)).toBeInTheDocument();
  });

  it('opens and closes an accessible mobile navigation drawer', async () => {
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const openButton = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(openButton);

    const dialog = screen.getByRole('dialog', { name: /menú de navegación/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /cerrar menú/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /coinvierte con nosotros/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /menú de navegación/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(openButton).toHaveFocus();
  });
});
