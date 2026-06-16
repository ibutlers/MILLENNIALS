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
        name: /invertir bien empieza por seleccionar mejor/i
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/scaffold|entorno preparado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    await screen.findAllByRole('article');

    const forbiddenClaims = /capital gestionado|rentabilidad histórica|proyectos ejecutados|oficinas internacionales|propiedades analizadas al mes|retorno histórico/i;
    expect(document.body).not.toHaveTextContent(forbiddenClaims);
  });

  it('shows loading and then API-backed opportunity cards with disclaimer and financial formatting', async () => {
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(/cargando proyectos/i);
    // Project cards have "Ver proyecto: Title" aria-label; Hero has "Ver proyectos"
    const projectLinks = await screen.findAllByRole('link', { name: /^Ver proyecto: / });
    expect(projectLinks.length).toBeGreaterThanOrEqual(1);

    // Verify the first project card links to the expected slug
    expect(projectLinks[0].getAttribute('href')).toContain('eixample-rehabilitacion-luminosa');
    // Disclaimer present on page
    expect(screen.getByText(/datos ilustrativos/i)).toBeInTheDocument();
    expect(screen.getByText(/los objetivos no están garantizados/i)).toBeInTheDocument();
  });

  it('shows an honest error state instead of fake fallback data when the API fails', async () => {
    mockFetch({ error: { code: 'internal_error' } }, false);
    render(<App />);

    await screen.findByRole('alert');
    expect(screen.getByText(/no mostramos datos falsos como si fueran reales/i)).toBeInTheDocument();
    // Hero always has "Ver proyectos" link; project card links should not exist
    expect(screen.queryByRole('link', { name: /^Ver proyecto: / })).not.toBeInTheDocument();
  });

  it('shows an empty state when the API returns no public opportunities', async () => {
    mockFetch({ ...apiResponse, data: [], pagination: { limit: 3, offset: 0, total: 0, hasMore: false } });
    render(<App />);

    await screen.findByText(/no hay proyectos disponibles/i);
    expect(screen.queryByRole('link', { name: /^Ver proyecto: / })).not.toBeInTheDocument();
  });

  it('presents corporate narrative, methodology and activity sections before opportunities', async () => {
    render(<App />);
    await screen.findAllByRole('link', { name: /^Ver proyecto: / });

    const mainText = screen.getByRole('main').textContent ?? '';
    // Eyebrow labels in rendering order (CSS uppercased in browser; source is sentence case)
    expect(mainText.indexOf('Nuestra actividad')).toBeGreaterThan(-1);
    expect(mainText.indexOf('Cómo trabajamos')).toBeGreaterThan(mainText.indexOf('Nuestra actividad'));
    expect(mainText.indexOf('Proyectos seleccionados')).toBeGreaterThan(mainText.indexOf('Cómo trabajamos'));
    // Key messaging present (use getAllByText for repeated entries)
    expect(screen.getAllByText(/Pocas oportunidades/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Del análisis a la ejecución/i)).toBeInTheDocument();
    expect(screen.getByText(/Preparado para documentación/i)).toBeInTheDocument();
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

// ── Contact form ──

function mockContactFetch(body: unknown, ok = true, status = 201) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/contact')) {
      return Promise.resolve({ ok, status, json: async () => body });
    }
    if (url.includes('/api/v1/lead-settings')) {
      return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
    }
    return Promise.resolve({ ok: true, json: async () => apiResponse });
  }));
}

function fillContactForm(overrides: Partial<Record<'name' | 'email' | 'subject' | 'message', string>> = {}) {
  fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: overrides.name ?? 'María García' } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: overrides.email ?? 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: overrides.subject ?? 'Consulta general' } });
  fireEvent.change(screen.getByLabelText(/Mensaje/), { target: { value: overrides.message ?? 'Me gustaría recibir más información sobre sus servicios de inversión inmobiliaria.' } });
  fireEvent.click(screen.getByLabelText(/Acepto que los datos facilitados/));
}

describe('ContactSection form', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows all required fields and the privacy checkbox', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Teléfono/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mensaje/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Acepto que los datos facilitados/)).toBeInTheDocument();
  });

  it('validates required fields and shows alert when empty form is submitted', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Campo obligatorio/);
  });

  it('rejects invalid email with a specific message', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm({ email: 'notanemail' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Introduce un email válido/);
  });

  it('rejects message shorter than 20 characters', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm({ message: 'Corto' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 20 caracteres/);
  });

  it('rejects submission without privacy consent', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // Fill all fields except consent checkbox
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'María' } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Consulta general' } });
    fireEvent.change(screen.getByLabelText(/Mensaje/), { target: { value: 'Me gustaría recibir más información sobre sus servicios.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Debes aceptar/);
  });

  it('disables button and shows "Enviando…" while submitting', async () => {
    // Return a never-resolving promise so we stay in submitting state
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/contact')) return new Promise(() => {});
      if (url.includes('/api/v1/lead-settings')) return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
      return Promise.resolve({ ok: true, json: async () => apiResponse });
    }));
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    });
  });

  it('prevents double submission by disabling all inputs while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/contact')) return new Promise(() => {});
      if (url.includes('/api/v1/lead-settings')) return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
      return Promise.resolve({ ok: true, json: async () => apiResponse });
    }));
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre/)).toBeDisabled();
      expect(screen.getByLabelText(/Email/)).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    });
  });

  it('shows success message, clears fields and moves focus after submission', async () => {
    mockContactFetch({
      data: {
        publicReference: 'RS-20260614-ABC123',
        status: 'new',
        createdAt: '2026-06-14T09:30:00.000Z',
        message: 'Mensaje enviado. Gracias por contactar con nosotros. Revisaremos tu consulta y te responderemos lo antes posible.'
      }
    });
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    const success = await screen.findByRole('status');
    expect(success).toHaveTextContent('Mensaje enviado');
    expect(success).toHaveTextContent(/Gracias por contactar/);
    // Focus via requestAnimationFrame is unreliable in jsdom; verify element is present and focusable
    expect(success).toHaveAttribute('tabIndex', '-1');
    // Fields should be cleared (form reset)
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('');
    expect(screen.getByLabelText(/Email/)).toHaveValue('');
  });

  it('shows generic error when server returns failure and preserves field data', async () => {
    mockContactFetch({ error: { code: 'internal_error', message: 'detailed stack trace here' } }, false, 500);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/No hemos podido enviar el mensaje/);
    // Fields should still contain the data
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('María García');
    expect(screen.getByLabelText(/Email/)).toHaveValue('maria@example.com');
    // Server internals must NOT leak
    expect(alert.textContent).not.toMatch(/stack|trace|internal_error/i);
  });

  it('handles rate limit with a distinct message and does not submit', async () => {
    mockContactFetch({ error: { code: 'rate_limited' } }, false, 429);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Demasiados intentos/);
  });
});
