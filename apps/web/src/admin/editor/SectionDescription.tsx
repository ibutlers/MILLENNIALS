import type { FormState } from './useEditorForm';

interface SectionDescriptionProps {
  values: Pick<FormState, 'description' | 'disclaimer'>;
  onChange: (field: keyof FormState, value: string) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionDescription({ values, onChange, errors, showValidation }: SectionDescriptionProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Descripción y tesis</h3>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Descripción *</span>
        <textarea
          value={values.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={8}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          placeholder="Describe la tesis de inversión, el activo, la ubicación y los fundamentos de la oportunidad."
        />
        {showValidation && errors.map((e, i) => (
          <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
        ))}
      </label>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Disclaimer legal</span>
        <textarea
          value={values.disclaimer}
          onChange={(e) => onChange('disclaimer', e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          placeholder="Texto legal opcional que se mostrará al pie de la página de la oportunidad."
        />
      </label>
    </div>
  );
}
