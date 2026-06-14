import type { FormState } from './useEditorForm';

interface SectionLocationProps {
  values: Pick<FormState, 'city' | 'countryCode' | 'district'>;
  onChange: (field: keyof FormState, value: string) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionLocation({ values, onChange, errors, showValidation }: SectionLocationProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Localización</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Ciudad *</span>
          <input
            value={values.city}
            onChange={(e) => onChange('city', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
            placeholder="Madrid"
          />
          {showValidation && errors.map((e, i) => (
            <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
          ))}
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Código país *</span>
          <input
            value={values.countryCode}
            onChange={(e) => onChange('countryCode', e.target.value.toUpperCase())}
            maxLength={2}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] uppercase"
            placeholder="ES"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Distrito</span>
        <input
          value={values.district}
          onChange={(e) => onChange('district', e.target.value)}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          placeholder="Salamanca"
        />
      </label>
    </div>
  );
}
