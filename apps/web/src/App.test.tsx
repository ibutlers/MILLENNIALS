import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Realstate landing', () => {
  it('renders an institutional public landing without unverified performance claims', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /inversión inmobiliaria con disciplina, datos y seguimiento operativo/i
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/scaffold|entorno preparado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();

    const forbiddenClaims = /capital gestionado|rentabilidad histórica|proyectos ejecutados|oficinas internacionales|propiedades analizadas al mes|retorno histórico/i;
    expect(document.body).not.toHaveTextContent(forbiddenClaims);
  });

  it('shows transparent opportunity cards with demo labels and risk/progress fields', () => {
    render(<App />);

    const opportunities = screen.getAllByRole('article', { name: /oportunidad demo/i });
    expect(opportunities).toHaveLength(3);

    for (const card of opportunities) {
      expect(within(card).getByText(/datos ilustrativos/i)).toBeInTheDocument();
      expect(within(card).getByText(/rentabilidad objetivo estimada/i)).toBeInTheDocument();
      expect(within(card).getByText(/plazo estimado/i)).toBeInTheDocument();
      expect(within(card).getByText(/ticket mínimo/i)).toBeInTheDocument();
      expect(within(card).getByText(/capital objetivo/i)).toBeInTheDocument();
      expect(within(card).getByText(/capital comprometido/i)).toBeInTheDocument();
      expect(within(card).getByText(/nivel de riesgo/i)).toBeInTheDocument();
      expect(within(card).getByText(/estado/i)).toBeInTheDocument();
    }
  });

  it('presents corporate narrative, methodology and technology sections before opportunities', () => {
    render(<App />);

    const mainText = screen.getByRole('main').textContent ?? '';
    expect(mainText.indexOf('Tesis de inversión')).toBeGreaterThan(-1);
    expect(mainText.indexOf('Metodología')).toBeGreaterThan(mainText.indexOf('Tesis de inversión'));
    expect(mainText.indexOf('Tecnología y análisis')).toBeGreaterThan(mainText.indexOf('Metodología'));
    expect(mainText.indexOf('Oportunidades actuales')).toBeGreaterThan(mainText.indexOf('Tecnología y análisis'));
    expect(screen.getAllByText(/documentación estructurada/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/actualización de avance/i)).toBeInTheDocument();
  });

  it('opens and closes an accessible mobile navigation drawer', () => {
    render(<App />);

    const openButton = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(openButton);

    const dialog = screen.getByRole('dialog', { name: /menú de navegación/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /cerrar menú/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /solicitar acceso/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /acceso inversores/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /idioma español seleccionado/i })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /menú de navegación/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(openButton).toHaveFocus();
  });
});
