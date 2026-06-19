import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './context';
import { AccessEntryPage } from './AccessEntryPage';

function renderAccessEntry(authEnabled: boolean, initialEntry = '/acceso') {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/config/public')) {
      return Promise.resolve(new Response(JSON.stringify({ authEnabled }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    if (url.includes('/api/auth/get-session')) {
      return Promise.resolve(new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    return Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }));
  }));

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider baseURL="http://localhost:3000">
        <AccessEntryPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AccessEntryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra el login funcional en /acceso cuando la autenticación está activa', async () => {
    renderAccessEntry(true);

    expect(await screen.findByRole('heading', { name: 'Acceso inversores' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acceder/i })).toBeInTheDocument();
  });

  it('mantiene la página de solicitud en /acceso cuando la autenticación está desactivada', async () => {
    renderAccessEntry(false);

    await waitFor(() => {
      expect(screen.getByText('Acceso privado')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /solicita acceso al club/i })).toBeInTheDocument();
  });

  it('mantiene el formulario de solicitud en /acceso#solicitud aunque la autenticación esté activa', async () => {
    renderAccessEntry(true, '/acceso#solicitud');

    expect(await screen.findByRole('button', { name: /solicitar acceso/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /solicita acceso al club/i })).toBeInTheDocument();
  });
});
