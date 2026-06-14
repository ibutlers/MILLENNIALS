import type { FormState } from './useEditorForm';

interface SectionStatusProps {
  values: Pick<FormState, 'editorialStatus' | 'visibility' | 'status'>;
  onChange: (field: keyof FormState, value: string) => void;
  errors: string[];
  showValidation: boolean;
}

export default function SectionStatus({ values, onChange, errors, showValidation }: SectionStatusProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Estado y visibilidad</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Estado editorial *</span>
          <select
            value={values.editorialStatus}
            onChange={(e) => onChange('editorialStatus', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          >
            <option value="draft">Borrador</option>
            <option value="review">En revisión</option>
            <option value="published">Publicado</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Visibilidad *</span>
          <select
            value={values.visibility}
            onChange={(e) => onChange('visibility', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          >
            <option value="private">Privado</option>
            <option value="public">Público</option>
            <option value="unlisted">No listado</option>
            <option value="draft">Borrador</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-[#9B7E5F]">Estado comercial *</span>
          <select
            value={values.status}
            onChange={(e) => onChange('status', e.target.value)}
            className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none focus:ring-1 focus:ring-[#7FA88C]"
          >
            <option value="coming_soon">Próximamente</option>
            <option value="open">Abierto</option>
            <option value="funding">Financiación</option>
            <option value="funded">Financiado</option>
            <option value="in_execution">En ejecución</option>
            <option value="commercializing">Comercializando</option>
            <option value="closed">Cerrado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
      </div>
      {showValidation && errors.map((e, i) => (
        <p key={i} className="text-xs text-red-400">{e}</p>
      ))}
    </div>
  );
}
