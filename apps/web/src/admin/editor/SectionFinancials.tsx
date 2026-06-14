import type { FormState } from './useEditorForm';
import { centsToEur, bpsToPct, eurToCents, pctToBps } from './finance';

interface SectionFinancialsProps {
  values: Pick<FormState, 'currency' | 'targetAmountCents' | 'committedAmountCents' | 'minimumInvestmentCents' | 'estimatedTermMonths' | 'targetReturnType' | 'targetReturnBps' | 'riskLevel' | 'closingDate'>;
  onChange: (field: keyof FormState, value: string | number) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionFinancials({ values, onChange, errors, showValidation }: SectionFinancialsProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Métricas financieras</h3>
      <p className="text-xs text-[#5C8D7A]">
        Los importes se introducen en euros y se convierten a céntimos. Los porcentajes se convierten a basis points.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Capital objetivo (€) *</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.targetAmountCents ? centsToEur(values.targetAmountCents) : '0.00'}
            onChange={(e) => onChange('targetAmountCents', eurToCents(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Capital comprometido (€)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.committedAmountCents ? centsToEur(values.committedAmountCents) : '0.00'}
            onChange={(e) => onChange('committedAmountCents', eurToCents(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Ticket mínimo (€) *</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.minimumInvestmentCents ? centsToEur(values.minimumInvestmentCents) : '0.00'}
            onChange={(e) => onChange('minimumInvestmentCents', eurToCents(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Plazo estimado (meses) *</span>
          <input
            type="number"
            min="1"
            max="360"
            value={values.estimatedTermMonths || 12}
            onChange={(e) => onChange('estimatedTermMonths', parseInt(e.target.value) || 0)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
            type="number"
            min="0"
            max="1000"
            step="0.01"
            value={values.targetReturnBps ? bpsToPct(values.targetReturnBps) : ''}
            onChange={(e) => onChange('targetReturnBps', pctToBps(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Moneda</span>
        <input
          value={values.currency}
          onChange={(e) => onChange('currency', e.target.value.toUpperCase())}
          maxLength={3}
          className="mt-1 block w-24 rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] uppercase"
        />
      </label>
      <hr className="border-[#1A3E48]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
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
      {showValidation && errors.map((e, i) => (
        <p key={i} className="text-xs text-red-400">{e}</p>
      ))}
    </div>
  );
}
