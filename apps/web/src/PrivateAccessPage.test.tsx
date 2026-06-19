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

describe('PrivateAccessPage — solicitud de acceso simplificada', () => {
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

  it('presenta una sola introducción y un único formulario', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.getByText('Acceso privado')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /solicita acceso al club/i })).toBeInTheDocument();
    expect(screen.getByText(/déjanos tus datos/i)).toBeInTheDocument();

    expect(screen.queryByText(/Coinvierte con nosotros/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuéntanos tu perfil inversor/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/la zona privada está reservada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/solicitud sin compromiso/i)).not.toBeInTheDocument();
  });

  it('mantiene el formulario con los campos mínimos necesarios', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Perfil/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Experiencia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Intereses/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Teléfono/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /solicitar acceso/i })).toBeInTheDocument();
  });

  it('no muestra breadcrumbs ni textos antiguos', () => {
    mockFetch();
    renderPrivateAccessPage();

    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cartera/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /acceso para inversores/i })).not.toBeInTheDocument();
  });
});
