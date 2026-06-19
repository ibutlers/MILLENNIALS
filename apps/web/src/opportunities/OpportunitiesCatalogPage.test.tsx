import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpportunitiesCatalogPage } from './OpportunitiesCatalogPage';
import { OpportunityDetailPage } from './OpportunityDetailPage';
import { opportunitiesResponse, opportunityDetailResponse } from './test-fixtures';

function renderWithProviders(path = '/proyectos') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/proyectos" element={<OpportunitiesCatalogPage />} />
          <Route path="/proyectos/:slug" element={<OpportunityDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockFetch(handler: (url: string) => { ok?: boolean; status?: number; body: unknown }) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const result = handler(url);
    return Promise.resolve({ ok: result.ok ?? true, status: result.status ?? 200, json: async () => result.body });
  }));
}

describe('public opportunities catalog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders cards, badges, financial metrics, progress and disclaimer from the API', async () => {
    mockFetch(() => ({ body: opportunitiesResponse }));
    renderWithProviders('/proyectos');

    await screen.findByRole('status');
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando catálogo/i);
    const cards = await screen.findAllByRole('article', { name: /Proyecto:/i });
    expect(cards).toHaveLength(2);
    const card = cards[0];
    expect(within(card).getByRole('img', { name: /patio rehabilitado demo/i })).toHaveAttribute('loading', 'lazy');
    expect(within(card).getByText(/barcelona\s*·\s*eixample/i)).toBeInTheDocument();
    expect(within(card).getByText(/residencial urbano/i)).toBeInTheDocument();
    expect(within(card).getByText(/rehabilitación energética/i)).toBeInTheDocument();
    expect(within(card).getByText(/en financiación/i)).toBeInTheDocument();
    expect(within(card).getByText(/riesgo medio/i)).toBeInTheDocument();
    expect(within(card).getByText(/15\.000\s*€/)).toBeInTheDocument();
    expect(within(card).getByText(/1\.250\.000\s*€/)).toBeInTheDocument();
    expect(within(card).getByText(/530\.000\s*€/)).toBeInTheDocument();
    expect(within(card).getByText(/42,4%/)).toBeInTheDocument();
    expect(within(card).getByRole('progressbar', { name: /financiación/i })).toHaveAttribute('aria-valuenow', '42.4');
    expect(within(card).getByText(/18 meses/i)).toBeInTheDocument();
    expect(within(card).getByText(/rentabilidad total/i)).toBeInTheDocument();
    expect(within(card).getByText(/12,3% \+50%\*/i)).toBeInTheDocument();
    expect(within(card).getByText(/cierre/i)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /ver proyecto/i })).toHaveAttribute('href', '/proyectos/eixample-rehabilitacion-luminosa');
    expect(screen.getAllByText(/objetivos no están garantizados/i).length).toBeGreaterThan(0);
  });

  it('syncs filters, sort and pagination with the URL and only sends allowed query params', async () => {
    mockFetch(() => ({ body: opportunitiesResponse }));
    renderWithProviders('/proyectos?city=Barcelona&riskLevel=medium&sort=fundingProgress&direction=desc&offset=6');
    await screen.findByRole('heading', { name: /Catálogo de proyectos inmobiliarios/i });

    expect(screen.getByLabelText(/ciudad/i)).toHaveValue('Barcelona');
    expect(screen.getByLabelText(/riesgo/i)).toHaveValue('medium');
    expect(screen.getByLabelText(/ordenar/i)).toHaveValue('fundingProgress');
    expect(screen.getByLabelText(/dirección/i)).toHaveValue('desc');

    fireEvent.change(screen.getByLabelText(/estado/i), { target: { value: 'funding' } });
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringMatching(/status=funding/), expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(fetch).not.toHaveBeenLastCalledWith(expect.stringMatching(/foo=/), expect.anything());
  });

  it('shows error and empty states honestly without private opportunities', async () => {
    mockFetch(() => ({ ok: false, status: 503, body: { error: { code: 'temporary_unavailable' } } }));
    renderWithProviders('/proyectos');
    expect(await screen.findByRole('alert')).toHaveTextContent(/no hemos podido cargar/i);
    expect(screen.queryByRole('article', { name: /proyecto público/i })).not.toBeInTheDocument();

    vi.unstubAllGlobals();
    mockFetch(() => ({ body: { ...opportunitiesResponse, data: [], pagination: { limit: 6, offset: 0, total: 0, hasMore: false } } }));
    renderWithProviders('/proyectos');
    expect(await screen.findByText(/no hay proyectos públicos/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/privada demo no pública/i);
  });
});

describe('public opportunity detail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a visual opportunity sheet without inventing absent private content', async () => {
    mockFetch(() => ({ body: opportunityDetailResponse }));
    renderWithProviders('/proyectos/eixample-rehabilitacion-luminosa');

    expect(await screen.findByRole('heading', { name: /rehabilitación luminosa en eixample/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /patio rehabilitado demo/i })[0]).toHaveAttribute('fetchpriority', 'high');
    expect(screen.getByText(/resumen/i)).toBeInTheDocument();
    expect(screen.getByText(/capital objetivo/i)).toBeInTheDocument();
    expect(screen.getByText(/capital comprometido/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /financiación/i })).toHaveAttribute('aria-valuenow', '42.4');
    expect(screen.getByText(/ticket mínimo/i)).toBeInTheDocument();
    expect(screen.getByText(/rentabilidad total objetivo estimada/i)).toBeInTheDocument();
    expect(screen.getByText(/12,3% \+50%\*/i)).toBeInTheDocument();
    expect(screen.getAllByText(/riesgo medio/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /highlights/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /riesgos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hitos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /media disponible/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /próximos pasos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solicitar información/i })).toHaveAttribute('href', '/proyectos/eixample-rehabilitacion-luminosa/solicitar-informacion');
    expect(screen.getByRole('link', { name: /coinvierte con nosotros/i })).toHaveAttribute('href', '/coinvierte');
    expect(document.body).not.toHaveTextContent(/invertir ahora|simulador|orden de inversión/i);
  });

  it('renders a safe not-found state for unknown slugs', async () => {
    mockFetch(() => ({ ok: false, status: 404, body: { error: { code: 'not_found' } } }));
    renderWithProviders('/proyectos/no-existe');
    expect(await screen.findByRole('heading', { name: /proyecto no encontrado/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a proyectos/i })).toHaveAttribute('href', '/proyectos');
  });
});
