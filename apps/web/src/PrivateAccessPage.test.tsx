import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PrivateAccessPage } from './PrivateAccessPage';

function renderPrivateAccessPage() {
  return render(
    <MemoryRouter>
      <PrivateAccessPage />
    </MemoryRouter>
  );
}

describe('PrivateAccessPage — acceso privado informativo', () => {
  it('muestra la cabecera mínima con marca y enlace de vuelta', () => {
    renderPrivateAccessPage();

    // Brand
    expect(screen.getByText('MC')).toBeInTheDocument();
    expect(screen.getByText('MILLENNIALS CONSTRUYEN')).toBeInTheDocument();

    // Return link
    const returnLink = screen.getByRole('link', { name: /volver al sitio/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink.getAttribute('href')).toBe('/');
  });

  it('muestra el panel editorial oscuro con eyebrow, título y puntos', () => {
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
    renderPrivateAccessPage();

    expect(screen.getByText('ACCESO PRIVADO')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /la zona de inversores está en preparación/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/el acceso estará reservado a inversores previamente validados/i)
    ).toBeInTheDocument();

    // CTA principal
    const solicitarLink = screen.getByRole('link', { name: /solicitar acceso/i });
    expect(solicitarLink).toBeInTheDocument();
    expect(solicitarLink.getAttribute('href')).toBe('/#coinvierte');

    // CTA secundario
    const proyectosLink = screen.getByRole('link', { name: /ver proyectos/i });
    expect(proyectosLink).toBeInTheDocument();
    expect(proyectosLink.getAttribute('href')).toBe('/#proyectos');

    // Disclaimer
    expect(
      screen.getByText(/enviar una solicitud no garantiza el acceso/i)
    ).toBeInTheDocument();
  });

  it('no muestra formularios de credenciales ni breadcrumbs', () => {
    renderPrivateAccessPage();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contactar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cartera/i)).not.toBeInTheDocument();
  });
});
