import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Realstate landing', () => {
  it('renders a professional public landing instead of the scaffold placeholder', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /encuentra una propiedad con criterio, datos y acompañamiento experto/i
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/scaffold|entorno preparado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver propiedades destacadas/i })).toHaveAttribute(
      'href',
      '#propiedades'
    );
  });

  it('shows an accessible property search panel with realistic controls', () => {
    render(<App />);

    const search = screen.getByRole('search', { name: /buscar propiedades/i });
    expect(within(search).getByLabelText(/operación/i)).toBeInTheDocument();
    expect(within(search).getByLabelText(/ubicación/i)).toBeInTheDocument();
    expect(within(search).getByLabelText(/tipo de propiedad/i)).toBeInTheDocument();
    expect(within(search).getByLabelText(/precio máximo/i)).toBeInTheDocument();
    expect(within(search).getByRole('button', { name: /buscar propiedades/i })).toBeInTheDocument();
  });

  it('presents featured properties and service benefits', () => {
    render(<App />);

    expect(screen.getAllByRole('article', { name: /propiedad destacada/i })).toHaveLength(3);
    expect(screen.getByText(/Ático luminoso en Chamberí/i)).toBeInTheDocument();
    expect(screen.getByText(/Valoración con datos reales/i)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Realstate/i);
  });
});
