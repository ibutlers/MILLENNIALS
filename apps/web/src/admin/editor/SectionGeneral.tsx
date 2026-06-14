import type { FormState } from './useEditorForm';

interface SectionGeneralProps {
  values: Pick<FormState, 'title' | 'slug' | 'shortDescription'>;
  onChange: (field: keyof FormState, value: string) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionGeneral({ values, onChange, errors, showValidation }: SectionGeneralProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Información general</h3>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Título *</span>
        <input
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          placeholder="Nombre de la oportunidad"
        />
        {showValidation && errors.map((e, i) => (
          <p key={i} className="mt-1 text-xs text-red-400">{e}</p>
        ))}
      </label>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Slug</span>
        <input
          value={values.slug}
          onChange={(e) => onChange('slug', e.target.value)}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C] font-mono text-sm"
          placeholder="nombre-de-la-oportunidad"
        />
      </label>
      <label className="block">
        <span className="text-sm text-[#9B7E5F]">Descripción breve</span>
        <textarea
          value={values.shortDescription}
          onChange={(e) => onChange('shortDescription', e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          placeholder="Resumen de una o dos líneas"
        />
      </label>
    </div>
  );
}
