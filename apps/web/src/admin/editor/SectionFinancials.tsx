import type { FormState } from './useEditorForm';
import { centsToEur, bpsToPct, eurToCents, pctToBps, parseLocaleNumber } from './finance';

interface SectionFinancialsProps {
  values: Pick<FormState, 'currency' | 'targetAmountCents' | 'committedAmountCents' | 'projectTotalAmountCents' | 'bankFinancingAmountCents' | 'minimumInvestmentCents' | 'estimatedTermMonths' | 'targetReturnType' | 'targetReturnBps' | 'riskLevel' | 'closingDate'>;
  onChange: (field: keyof FormState, value: string | number) => void;
  errors: string[];
  showValidation: boolean;
}

function moneyValue(cents: number) {
  return cents ? centsToEur(cents) : '0.00';
}

export default function SectionFinancials({ values, onChange, errors, showValidation }: SectionFinancialsProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-serif text-lg text-[#7FA88C]">Datos clave públicos</h3>
        <p className="mt-2 text-xs leading-5 text-[#5C8D7A]">
          Estos campos alimentan la ficha pública: Inversión, Retorno estimado, Plazo estimado, Ticket mínimo, CAPEX total,
          Financiación bancaria y Progreso de inversión. El capital comprometido solo se usa para calcular la barra de progreso.
        </p>
      </div>

      <div className="rounded border border-[#1A3E48] bg-[#08191C] p-4">
        <h4 className="text-sm font-medium text-[#FBF7F0]">Capital e inversión</h4>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Inversión / capital objetivo (€) *</span>
            <input
              type="text"
              inputMode="decimal"
              value={moneyValue(values.targetAmountCents)}
              onChange={(e) => onChange('targetAmountCents', eurToCents(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
            <span className="mt-1 block text-[0.68rem] text-[#5C8D7A]">Se muestra como “Inversión” en la ficha pública.</span>
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Capital comprometido (€)</span>
            <input
              type="text"
              inputMode="decimal"
              value={moneyValue(values.committedAmountCents)}
              onChange={(e) => onChange('committedAmountCents', eurToCents(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
            <span className="mt-1 block text-[0.68rem] text-[#5C8D7A]">No se muestra como importe; alimenta el progreso.</span>
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">CAPEX total (€)</span>
            <input
              type="text"
              inputMode="decimal"
              value={moneyValue(values.projectTotalAmountCents)}
              onChange={(e) => onChange('projectTotalAmountCents', eurToCents(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Financiación bancaria (€)</span>
            <input
              type="text"
              inputMode="decimal"
              value={moneyValue(values.bankFinancingAmountCents)}
              onChange={(e) => onChange('bankFinancingAmountCents', eurToCents(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
          </label>
        </div>
      </div>

      <div className="rounded border border-[#1A3E48] bg-[#08191C] p-4">
        <h4 className="text-sm font-medium text-[#FBF7F0]">Retorno, plazo y ticket</h4>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Ticket mínimo (€) *</span>
            <input
              type="text"
              inputMode="decimal"
              value={moneyValue(values.minimumInvestmentCents)}
              onChange={(e) => onChange('minimumInvestmentCents', eurToCents(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Plazo estimado (meses) *</span>
            <input
              type="text"
              inputMode="numeric"
              value={values.estimatedTermMonths || 12}
              onChange={(e) => onChange('estimatedTermMonths', Math.max(0, Math.round(parseLocaleNumber(e.target.value))))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Tipo de retorno</span>
            <select
              value={values.targetReturnType}
              onChange={(e) => onChange('targetReturnType', e.target.value)}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            >
              <option value="">Sin especificar</option>
              <option value="target_annual_return">Retorno anual objetivo</option>
              <option value="target_total_return">Retorno total objetivo</option>
              <option value="target_irr">TIR objetivo</option>
              <option value="target_roi">ROI objetivo</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-[#9B7E5F]">Retorno objetivo (%)</span>
            <input
              type="text"
              inputMode="decimal"
              value={values.targetReturnBps ? bpsToPct(values.targetReturnBps) : ''}
              onChange={(e) => onChange('targetReturnBps', pctToBps(parseLocaleNumber(e.target.value)))}
              className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Moneda</span>
          <select
            value={values.currency || 'EUR'}
            onChange={(e) => onChange('currency', e.target.value)}
            className="mt-1 block w-32 rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] uppercase"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Fecha de cierre</span>
          <input
            type="date"
            value={values.closingDate}
            onChange={(e) => onChange('closingDate', e.target.value)}
            className="mt-1 block rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="text-sm text-[#9B7E5F]">Nivel de riesgo</span>
        <select
          value={values.riskLevel}
          onChange={(e) => onChange('riskLevel', e.target.value)}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
        >
          <option value="low">Bajo</option>
          <option value="medium">Medio</option>
          <option value="high">Alto</option>
          <option value="very_high">Muy alto</option>
        </select>
        <span className="mt-1 block text-[0.68rem] text-[#5C8D7A]">Dato interno/admin; no se muestra en la ficha pública simplificada.</span>
      </label>

      {showValidation && errors.map((e, i) => (
        <p key={i} className="text-xs text-red-400">{e}</p>
      ))}
    </div>
  );
}
