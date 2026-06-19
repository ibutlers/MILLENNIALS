import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import AdminLayout from './AdminLayout';

vi.mock('../auth/context', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    checkedAvailability: true,
    isAuthAvailable: true,
    logout: vi.fn(),
  }),
}));

describe('AdminLayout', () => {
  it('offers a login CTA with return URL when unauthenticated', () => {
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
});
