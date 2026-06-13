import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PlannedAccess } from './PlannedAccess';

function renderPlannedAccess(variant: 'access' | 'investors') {
  return render(
    <MemoryRouter>
      <PlannedAccess variant={variant} />
    </MemoryRouter>
  );
}

describe('Planned private area information pages', () => {
  it('explains that access is coming soon without simulating authentication', () => {
    renderPlannedAccess('access');

    expect(screen.getByRole('heading', { level: 1, name: /acceso privado en preparación/i })).toBeInTheDocument();
    expect(screen.getByText(/no permite iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByText(/magic link/i)).toBeInTheDocument();
    expect(screen.getByText(/segundo factor/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar|entrar|invertir/i })).not.toBeInTheDocument();
  });

  it('documents the future investor area without simulating investments or portfolio values', () => {
    renderPlannedAccess('investors');

    expect(screen.getByRole('heading', { level: 1, name: /área de inversores en preparación/i })).toBeInTheDocument();
    expect(screen.getByText(/Oportunidades/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cartera/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Documentos/)).toBeInTheDocument();
    expect(screen.getByText(/KYC pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/escenario conservador/i)).toBeInTheDocument();
    expect(screen.getByText(/capital potencialmente en riesgo/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/inversión completada|beneficio seguro|plusvalía garantizada/i);
  });
});
