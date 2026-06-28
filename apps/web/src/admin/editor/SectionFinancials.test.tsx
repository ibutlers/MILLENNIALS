import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionFinancials from './SectionFinancials';
import { EMPTY_FORM, formToApiPayload, oppToForm, type FormState, type OppFull } from './useEditorForm';

function makeForm(overrides: Partial<FormState> = {}): FormState {
  return {
    ...EMPTY_FORM,
    targetAmountCents: 2_000_000_00,
    committedAmountCents: 500_000_00,
    projectTotalAmountCents: 6_000_000_00,
    bankFinancingAmountCents: 4_000_000_00,
    minimumInvestmentCents: 5_000_00,
    estimatedTermMonths: 42,
    targetReturnType: 'target_annual_return',
    targetReturnBps: 700,
    ...overrides,
  };
}

describe('SectionFinancials', () => {
  it('edits every public Datos clave field used by the public project detail', () => {
    const onChange = vi.fn();

    render(<SectionFinancials values={makeForm()} onChange={onChange} errors={[]} showValidation={false} />);

    expect(screen.getByRole('heading', { name: /datos clave públicos/i })).toBeInTheDocument();
    expect(screen.getByText(/estos campos alimentan la ficha pública/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/inversión.*capital objetivo/i)).toHaveValue('2000000.00');
    expect(screen.getByLabelText(/capital comprometido/i)).toHaveValue('500000.00');
    expect(screen.getByLabelText(/capex total/i)).toHaveValue('6000000.00');
    expect(screen.getByLabelText(/financiación bancaria/i)).toHaveValue('4000000.00');
    expect(screen.getByLabelText(/ticket mínimo/i)).toHaveValue('5000.00');
    expect(screen.getByLabelText(/plazo estimado/i)).toHaveValue('42');
    expect(screen.getByLabelText(/retorno objetivo/i)).toHaveValue('7.00');

    fireEvent.change(screen.getByLabelText(/capex total/i), { target: { value: '6.500.000' } });
    fireEvent.change(screen.getByLabelText(/financiación bancaria/i), { target: { value: '4.500.000' } });

    expect(onChange).toHaveBeenCalledWith('projectTotalAmountCents', 650_000_000);
    expect(onChange).toHaveBeenCalledWith('bankFinancingAmountCents', 450_000_000);
  });

  it('maps CAPEX and bank financing between admin API rows and save payloads', () => {
    const opportunity = {
      id: 'opp-1',
      slug: 'castrelos',
      title: 'Castrelos',
      short_description: 'Resumen',
      description: 'Descripción',
      city: 'Vigo',
      country_code: 'ES',
      district: 'Castrelos',
      asset_type: 'Residencial',
      strategy: 'Promoción residencial',
      editorial_status: 'published',
      visibility: 'public',
      status: 'in_study',
      currency: 'EUR',
      target_amount_cents: '200000000',
      committed_amount_cents: '0',
      project_total_amount_cents: '600000000',
      bank_financing_amount_cents: '400000000',
      minimum_investment_cents: '500000',
      estimated_term_months: '42',
      target_return_type: 'target_annual_return',
      target_return_bps: '700',
      risk_level: 'medium',
      closing_date: null,
      disclaimer: null,
      version: 3,
      published_at: '2026-06-15T08:00:00.000Z',
      created_at: '2026-06-01T08:00:00.000Z',
      updated_at: '2026-06-20T08:00:00.000Z',
    } satisfies OppFull;

    const form = oppToForm(opportunity);
    expect(form.projectTotalAmountCents).toBe(6_000_000_00);
    expect(form.bankFinancingAmountCents).toBe(4_000_000_00);

    expect(formToApiPayload(form)).toEqual(expect.objectContaining({
      targetAmountCents: 2_000_000_00,
      projectTotalAmountCents: 6_000_000_00,
      bankFinancingAmountCents: 4_000_000_00,
    }));
  });
});
