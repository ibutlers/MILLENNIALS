import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import AdminLayout from './AdminLayout';

const authMock = {
  user: null as {
    id: string;
    email: string;
    name: string;
    roles: string[];
    twoFactorEnabled?: boolean;
  } | null,
  isAuthenticated: false,
  isLoading: false,
  checkedAvailability: true,
  isAuthAvailable: true,
  logout: vi.fn(),
};

vi.mock('../auth/context', () => ({
  useAuth: () => authMock,
}));

const queryMock = {
  isLoading: false,
  isFetching: false,
  isError: false,
  data: undefined as unknown,
  error: null as Error | null,
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => queryMock,
  };
});

function resetAuth() {
  authMock.user = null;
  authMock.isAuthenticated = false;
  authMock.isLoading = false;
  authMock.checkedAvailability = true;
  authMock.isAuthAvailable = true;
}

function resetQuery() {
  queryMock.isLoading = false;
  queryMock.isFetching = false;
  queryMock.isError = false;
  queryMock.data = undefined;
  queryMock.error = null;
}

function setAuth(user: NonNullable<typeof authMock.user>) {
  authMock.user = user;
  authMock.isAuthenticated = true;
  authMock.isLoading = false;
  authMock.checkedAvailability = true;
  authMock.isAuthAvailable = true;
}

function setQueryError(status: number, code: string) {
  const err = new Error('Forbidden') as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  queryMock.isError = true;
  queryMock.error = err;
  queryMock.isLoading = false;
  queryMock.isFetching = false;
}

describe('AdminLayout', () => {
  it('offers a login CTA with return URL when unauthenticated', () => {
    resetAuth();
    resetQuery();

    render(
      <MemoryRouter initialEntries={['/admin/oportunidades?limit=20']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    const loginLink = screen.getByRole('link', { name: /iniciar sesión/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute(
      'href',
      `/acceso/login?retorno=${encodeURIComponent('/admin/oportunidades?limit=20')}`,
    );
  });

  it('shows spinner while the admin preflight is in flight', () => {
    resetAuth();
    setAuth({ id: 'u1', email: 'op@mc.test', name: 'Op', roles: ['operator'] });
    queryMock.isLoading = true;
    queryMock.isFetching = false;
    queryMock.isError = false;
    queryMock.error = null;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/verificando acceso/i)).toBeInTheDocument();
  });

  it('shows "Sin permisos" when the preflight returns 403', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u2', email: 'inv@mc.test', name: 'Inv', roles: ['investor'] });
    setQueryError(403, 'forbidden');

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sin permisos')).toBeInTheDocument();
    expect(screen.getByText(/no tiene rol administrativo u operador/i)).toBeInTheDocument();
  });

  it('shows restricted-access CTA when the preflight returns 401', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u3', email: 'x@mc.test', name: 'X', roles: [] });
    setQueryError(401, 'unauthorized');

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /iniciar sesión con otra cuenta/i })).toBeInTheDocument();
  });

  it('guides authenticated admins to MFA setup when the preflight requires it', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u5', email: 'admin@mc.test', name: 'Admin', roles: ['admin'], twoFactorEnabled: false });
    setQueryError(403, 'mfa_required');

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText(/verificación en dos pasos/i)).toBeInTheDocument();
    const setupLink = screen.getByRole('link', { name: /configurar.*2fa|configurar.*verificación/i });
    expect(setupLink).toHaveAttribute('href', `/acceso/2fa?retorno=${encodeURIComponent('/admin')}`);
  });

  it('renders the admin shell for an active admin without MFA when the server preflight allows access', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u6', email: 'admin-no-mfa@mc.test', name: 'Admin sin MFA', roles: ['admin'], twoFactorEnabled: false });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('Panel administrativo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText(/verificación en dos pasos requerida/i)).not.toBeInTheDocument();
  });

  it('fail-closed on unknown preflight errors', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u4', email: 'a@mc.test', name: 'A', roles: ['admin'] });
    queryMock.isError = true;
    queryMock.error = new Error('Network error');
    queryMock.isLoading = false;
    queryMock.isFetching = false;

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText(/no se pudo verificar el acceso/i)).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('muestra staff legacy como operator y oculta navegación admin-only', () => {
    resetAuth();
    resetQuery();
    setAuth({ id: 'u7', email: 'staff@mc.test', name: 'Staff Legacy', roles: ['staff'] });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText('operator')).toBeInTheDocument();
    expect(screen.queryByText('staff')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument();
  });
});
