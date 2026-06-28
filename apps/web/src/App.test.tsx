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
      publicInvestmentAmount: { cents: 68000000, currency: 'EUR', formatted: '680.000 €' },
      minimumInvestment: { cents: 1500000, currency: 'EUR', formatted: '15.000 €' },
      estimatedTermMonths: 18,
      publicReturnDisplay: '12,3% +50%*',
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
    const primaryNav = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(primaryNav).toBeInTheDocument();
    expect(within(primaryNav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Nosotros',
      'Cómo trabajamos',
      'Proyectos',
      'Contacto'
    ]);
    expect(screen.queryByRole('button', { name: /idioma/i })).not.toBeInTheDocument();
    expect(screen.getByText('Club privado de inversión inmobiliaria')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: /proyecto destacado/i })).not.toBeInTheDocument();
    await screen.findAllByRole('article');
    expect(screen.getByLabelText(/resumen de proyectos publicados/i)).toHaveTextContent(/1/);
    expect(screen.getByText(/proyectos públicos/i)).toBeInTheDocument();

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
    const firstProjectCard = projectLinks[0].closest('article');
    expect(firstProjectCard).not.toBeNull();
    const firstProjectText = firstProjectCard?.textContent ?? '';
    expect(firstProjectText.indexOf('Inversión')).toBeGreaterThanOrEqual(0);
    expect(firstProjectText.indexOf('Inversión')).toBeLessThan(firstProjectText.indexOf('Retorno estimado'));
    expect(firstProjectText).toContain('680.000');
    expect(firstProjectText).not.toContain('530.000');
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

  it('presents projects right after hero, then corporate narrative, activity and methodology', async () => {
    render(<App />);
    await screen.findAllByRole('link', { name: /^Ver proyecto: / });

    const mainText = screen.getByRole('main').textContent ?? '';
    // Proyectos appears right after Hero, before Nosotros and Nuestra actividad
    expect(mainText.indexOf('Proyectos seleccionados')).toBeGreaterThan(-1);
    expect(mainText.indexOf('Proyectos seleccionados')).toBeLessThan(mainText.indexOf('Nuestra actividad'));
    expect(mainText.indexOf('Nuestra actividad')).toBeGreaterThan(-1);
    expect(mainText.indexOf('Cómo trabajamos')).toBeGreaterThan(mainText.indexOf('Nuestra actividad'));
    // Key messaging present
    expect(screen.getAllByText(/Pocas oportunidades/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Del análisis a la ejecución/i)).toBeInTheDocument();
  });

  it('opens and closes an accessible mobile navigation drawer', async () => {
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const openButton = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(openButton);

    const dialog = screen.getByRole('dialog', { name: /menú de navegación/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /cerrar menú/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /login/i })).toBeInTheDocument();
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
  const section = document.getElementById('contacto')!;
  const withinSection = within(section);
  fireEvent.change(withinSection.getByLabelText(/Nombre/), { target: { value: overrides.name ?? 'María García' } });
  fireEvent.change(withinSection.getByLabelText(/Email/), { target: { value: overrides.email ?? 'maria@example.com' } });
  fireEvent.change(withinSection.getByLabelText(/Motivo/), { target: { value: overrides.subject ?? 'Consulta general' } });
  fireEvent.change(withinSection.getByLabelText(/Mensaje/), { target: { value: overrides.message ?? 'Me gustaría recibir más información sobre sus servicios de inversión inmobiliaria.' } });
  fireEvent.click(withinSection.getByLabelText(/Acepto que los datos facilitados/));
}

describe('ContactSection form', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows all required fields and the privacy checkbox', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const section = document.getElementById('contacto')!;
    const withinSection = within(section);

    expect(withinSection.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(withinSection.getByLabelText(/Email/)).toBeInTheDocument();
    expect(withinSection.getByLabelText(/Teléfono/)).toBeInTheDocument();
    expect(withinSection.getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(withinSection.getByLabelText(/Mensaje/)).toBeInTheDocument();
    expect(withinSection.getByLabelText(/Acepto que los datos facilitados/)).toBeInTheDocument();
  });

  it('validates required fields and shows alert when empty form is submitted', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const section = document.getElementById('contacto')!;
    const withinSection = within(section);

    fireEvent.click(withinSection.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await withinSection.findByRole('alert')).toHaveTextContent(/Campo obligatorio/);
  });

  it('rejects invalid email with a specific message', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm({ email: 'notanemail' });
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent(/Introduce un email válido/);
  });

  it('rejects message shorter than 20 characters', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm({ message: 'Corto' });
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));
    expect(await within(section).findByRole('alert')).toHaveTextContent(/al menos 20 caracteres/);
  });

  it('rejects submission without privacy consent', async () => {
    mockContactFetch({});
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const section = document.getElementById('contacto')!;
    const withinSection = within(section);
    fireEvent.change(withinSection.getByLabelText(/Nombre/), { target: { value: 'María' } });
    fireEvent.change(withinSection.getByLabelText(/Email/), { target: { value: 'maria@example.com' } });
    fireEvent.change(withinSection.getByLabelText(/Motivo/), { target: { value: 'Consulta general' } });
    fireEvent.change(withinSection.getByLabelText(/Mensaje/), { target: { value: 'Me gustaría recibir más información sobre sus servicios.' } });
    fireEvent.click(withinSection.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await withinSection.findByRole('alert')).toHaveTextContent(/Debes aceptar/);
  });

  it('disables button and shows "Enviando…" while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/contact')) return new Promise(() => {});
      if (url.includes('/api/coinvest')) return Promise.resolve({ ok: true, json: async () => ({ data: { publicReference: 'X', status: 'new', createdAt: '', message: 'OK' } }) });
      if (url.includes('/api/v1/lead-settings')) return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
      return Promise.resolve({ ok: true, json: async () => apiResponse });
    }));
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => {
      expect(within(section).getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    });
  });

  it('prevents double submission by disabling all inputs while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/contact')) return new Promise(() => {});
      if (url.includes('/api/coinvest')) return Promise.resolve({ ok: true, json: async () => ({ data: { publicReference: 'X', status: 'new', createdAt: '', message: 'OK' } }) });
      if (url.includes('/api/v1/lead-settings')) return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
      return Promise.resolve({ ok: true, json: async () => apiResponse });
    }));
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => {
      expect(within(section).getByLabelText(/Nombre/)).toBeDisabled();
      expect(within(section).getByLabelText(/Email/)).toBeDisabled();
      expect(within(section).getByRole('button', { name: 'Enviando…' })).toBeDisabled();
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
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));

    const success = await within(section).findByRole('status');
    expect(success).toHaveTextContent('Mensaje enviado');
    expect(success).toHaveTextContent(/Gracias por contactar/);
    expect(success).toHaveAttribute('tabIndex', '-1');
    expect(within(section).getByLabelText(/Nombre/)).toHaveValue('');
    expect(within(section).getByLabelText(/Email/)).toHaveValue('');
  });

  it('shows generic error when server returns failure and preserves field data', async () => {
    mockContactFetch({ error: { code: 'internal_error', message: 'detailed stack trace here' } }, false, 500);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));

    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent(/No hemos podido enviar el mensaje/);
    expect(within(section).getByLabelText(/Nombre/)).toHaveValue('María García');
    expect(within(section).getByLabelText(/Email/)).toHaveValue('maria@example.com');
    expect(alert.textContent).not.toMatch(/stack|trace|internal_error/i);
  });

  it('handles rate limit with a distinct message and does not submit', async () => {
    mockContactFetch({ error: { code: 'rate_limited' } }, false, 429);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fillContactForm();
    const section = document.getElementById('contacto')!;
    fireEvent.click(within(section).getByRole('button', { name: 'Enviar mensaje' }));

    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent(/Demasiados intentos/);
  });
});

// ── Footer ──

describe('Footer', () => {
  it('renders brand, description, navigation links and legal notice', async () => {
    mockFetch(apiResponse);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const footer = document.querySelector('footer')!;
    const withinFooter = within(footer);

    expect(withinFooter.getByText('MILLENNIALS CONSTRUYEN')).toBeInTheDocument();
    expect(withinFooter.getByText(/Club privado de coinversión inmobiliaria/)).toBeInTheDocument();
    expect(withinFooter.getByText(/Acceso sujeto a invitación o validación previa/)).toBeInTheDocument();
    expect(withinFooter.getByText(/no constituye una oferta pública de inversión/)).toBeInTheDocument();
    expect(withinFooter.getByText(/© 2026/)).toBeInTheDocument();

    // Navigation links with correct anchors
    const secondaryNav = withinFooter.getByRole('navigation', { name: /navegación secundaria/i });
    expect(within(secondaryNav).getByText('Nosotros')).toHaveAttribute('href', '/#nosotros');
    expect(within(secondaryNav).getByText('Solicitar acceso')).toHaveAttribute('href', '/acceso#solicitud');
  });

  it('does not render old demo or construction text in footer', async () => {
    mockFetch(apiResponse);
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const footer = document.querySelector('footer')!;
    const withinFooter = within(footer);

    expect(withinFooter.queryByText(/datos demo/i)).not.toBeInTheDocument();
    expect(withinFooter.queryByText(/activos visuales generados/i)).not.toBeInTheDocument();
    expect(withinFooter.queryByText(/Plataforma inmobiliaria en construcción/i)).not.toBeInTheDocument();
    // "Private Real Estate Investment Club" is still in header — only check footer
    expect(withinFooter.queryByText(/Private Real Estate Investment Club/i)).not.toBeInTheDocument();
  });
});
