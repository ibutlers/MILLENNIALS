import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PrivateAccessPage } from './PrivateAccessPage';

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/api/v1/lead-settings')) {
      return Promise.resolve({ ok: true, json: async () => ({ enabled: false }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }));
}

function renderPrivateAccessPage() {
  return render(
    <MemoryRouter>
      <PrivateAccessPage />
    </MemoryRouter>
  );
}

describe('PrivateAccessPage — acceso privado informativo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la cabecera mínima con marca y enlace de vuelta', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.getByText('MC')).toBeInTheDocument();
    expect(screen.getByText('MILLENNIALS CONSTRUYEN')).toBeInTheDocument();

    const returnLink = screen.getByRole('link', { name: /volver al sitio/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink.getAttribute('href')).toBe('/');
  });

  it('muestra el panel editorial oscuro con eyebrow, título y puntos', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.getByText('ÁREA PRIVADA')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /acceso para inversores/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/la zona privada reunirá/i)).toBeInTheDocument();
    expect(screen.getByText('Documentación centralizada')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento de proyectos')).toBeInTheDocument();
    expect(screen.getByText('Comunicaciones privadas')).toBeInTheDocument();
    expect(
      screen.getByText(/el acceso se habilitará individualmente/i)
    ).toBeInTheDocument();
  });

  it('muestra el panel informativo con CTAs correctos', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.getByText('ACCESO PRIVADO')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /la zona de inversores está en preparación/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/el acceso estará reservado a inversores previamente validados/i)
    ).toBeInTheDocument();

    // CTA principal → #solicitud (ancla en la misma página)
    const solicitarLink = screen.getByRole('link', { name: /solicitar acceso/i });
    expect(solicitarLink).toBeInTheDocument();
    expect(solicitarLink.getAttribute('href')).toBe('#solicitud');

    // CTA secundario
    const proyectosLink = screen.getByRole('link', { name: /ver proyectos/i });
    expect(proyectosLink).toBeInTheDocument();
    expect(proyectosLink.getAttribute('href')).toBe('/#proyectos');

    // Disclaimer
    expect(
      screen.getByText(/enviar una solicitud no garantiza el acceso/i)
    ).toBeInTheDocument();
  });

  it('no muestra breadcrumbs ni textos antiguos', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cartera/i)).not.toBeInTheDocument();
  });

  it('incluye el formulario de solicitud de acceso', () => {
    mockFetch();
    renderPrivateAccessPage();

    // El formulario de coinvestir debe estar presente (CoinvestSection)
    expect(screen.getByText(/Coinvierte con nosotros/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Perfil/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Experiencia/)).toBeInTheDocument();
  });
});
