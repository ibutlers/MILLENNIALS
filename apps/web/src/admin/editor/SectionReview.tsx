import type { FormState } from './useEditorForm';
import type { HighlightItem, RiskItem, MediaItem } from '../SubEntityEditors';
import { getMissingFields } from './useEditorForm';

interface SectionReviewProps {
  formData: FormState;
  highlights: HighlightItem[];
  risks: RiskItem[];
  media: MediaItem[];
  subEntityCounts: {
    highlights: number;
    risks: number;
    milestones: number;
    media: number;
  };
  milestonesCount: number;
  isAdmin: boolean;
  isNew: boolean;
  isPublishing: boolean;
  isSendingReview: boolean;
  onPublish: () => void;
  onSendToReview: () => void;
}

export default function SectionReview({
  formData,
  highlights,
  risks,
  media,
  subEntityCounts,
  milestonesCount,
  isAdmin,
  isNew,
  isPublishing,
  isSendingReview,
  onPublish,
  onSendToReview,
}: SectionReviewProps) {
  const missing = getMissingFields(formData, highlights, risks, media);

  return (
    <div className="space-y-8 max-w-2xl">
      <h3 className="font-serif text-lg text-[#7FA88C]">Revisión y publicación</h3>

      {/* Validation summary */}
      <div className="rounded border border-[#1A3E48] bg-[#0F2A30] p-5">
        <h4 className="font-medium text-[#FBF7F0] mb-3">Resumen de validación</h4>
        {missing.length === 0 ? (
          <div className="flex items-center gap-2 text-[#7FA88C]">
            <span>✓</span>
            <span className="text-sm">Todos los campos requeridos están completos.</span>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#9B7E5F] mb-2">Campos pendientes:</p>
            <ul className="space-y-1">
              {missing.map((field) => (
                <li key={field} className="flex items-center gap-2 text-sm text-red-400">
                  <span>✗</span> {field}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="rounded border border-[#1A3E48] bg-[#0F2A30] p-5">
        <h4 className="font-medium text-[#FBF7F0] mb-3">Checklist de publicación</h4>
        <ul className="space-y-3">
          {[
            { label: 'Título y descripción completos', ok: !!formData.title.trim() && !!formData.description.trim() },
            { label: 'Localización definida', ok: !!formData.city.trim() && !!formData.countryCode.trim() },
            { label: 'Activo y estrategia definidos', ok: !!formData.assetType.trim() && !!formData.strategy.trim() },
            { label: 'Métricas financieras completas', ok: formData.targetAmountCents > 0 && formData.minimumInvestmentCents > 0 },
            { label: 'Highlights añadidos', ok: highlights.length > 0 },
            { label: 'Al menos 1 riesgo identificado', ok: risks.length > 0 },
            { label: 'Al menos 1 imagen', ok: media.length > 0 },
            { label: 'Al menos 1 hito definido', ok: milestonesCount > 0 },
          ].map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span className={item.ok ? 'text-[#7FA88C]' : 'text-[#9B7E5F]'}>
                {item.ok ? '✓' : '○'}
              </span>
              <span className={item.ok ? 'text-[#FBF7F0]' : 'text-[#9B7E5F]'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Counts summary */}
      <div className="grid gap-3 sm:grid-cols-4 text-center">
        {[
          { label: 'Highlights', count: subEntityCounts.highlights },
          { label: 'Riesgos', count: subEntityCounts.risks },
          { label: 'Hitos', count: subEntityCounts.milestones },
          { label: 'Imágenes', count: subEntityCounts.media },
        ].map((stat) => (
          <div key={stat.label} className="rounded border border-[#1A3E48] bg-[#0F2A30] p-3">
            <p className="text-2xl font-medium text-[#FBF7F0]">{stat.count}</p>
            <p className="text-xs text-[#9B7E5F]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {isAdmin && (
          <button
            onClick={onSendToReview}
            disabled={isSendingReview || isNew}
            className="rounded border border-[#7FA88C] px-5 py-2.5 text-sm font-medium text-[#7FA88C] hover:bg-[#1A3E48] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C]"
          >
            {isSendingReview ? 'Enviando…' : 'Enviar a revisión'}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={onPublish}
            disabled={isPublishing || isNew}
            className="rounded bg-[#7FA88C] px-5 py-2.5 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C]"
          >
            {isPublishing ? 'Publicando…' : 'Publicar'}
          </button>
        )}
        {!isAdmin && (
          <p className="text-sm text-[#9B7E5F]">
            Solo administradores y operadores pueden publicar.
          </p>
        )}
      </div>
    </div>
  );
}
