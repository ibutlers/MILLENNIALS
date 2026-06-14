import type { FormState } from './useEditorForm';

interface SectionStrategyProps {
  values: Pick<FormState, 'assetType' | 'strategy'>;
  onChange: (field: keyof FormState, value: string) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionStrategy({ values, onChange, errors, showValidation }: SectionStrategyProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Tipo de activo y estrategia</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Tipo de activo *</span>
          <input
            value={values.assetType}
            onChange={(e) => onChange('assetType', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            placeholder="Residencial, Comercial, etc."
          />
          {showValidation && errors.map((e, i) => (
            <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
          ))}
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Estrategia *</span>
          <input
            value={values.strategy}
            onChange={(e) => onChange('strategy', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            placeholder="Compra-reforma-venta, Alquiler, etc."
          />
        </label>
      </div>
    </div>
  );
}
