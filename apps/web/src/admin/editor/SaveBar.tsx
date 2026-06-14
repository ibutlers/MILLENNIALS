interface SaveBarProps {
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
  isNew: boolean;
  version: number;
  lastSavedAt: string | null;
  saveStatus: string;
  conflict: { currentVersion: number; providedVersion: number } | null;
}

export default function SaveBar({
  onSave,
  isSaving,
  isDirty,
  isNew,
  version,
  lastSavedAt,
  saveStatus,
  conflict: _conflict,
}: SaveBarProps) {
  return (
    <div className="shrink-0 border-t border-[#1A3E48] bg-[#0F2A30] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={isSaving || (!isDirty && !isNew)}
            className="rounded bg-[#7FA88C] px-6 py-2 font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C] transition-colors"
          >
            {isSaving ? 'Guardando…' : isNew ? 'Crear borrador' : 'Guardar cambios'}
          </button>
          {isDirty && (
            <span className="text-sm text-[#9B7E5F]" aria-live="polite">
              Cambios sin guardar
            </span>
          )}
          {saveStatus && !isSaving && (
            <span className="text-sm text-[#7FA88C]" aria-live="polite">
              {saveStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-[#5C8D7A]">
          {lastSavedAt && <span>Guardado: {lastSavedAt}</span>}
          <span>Versión {version || '—'}</span>
        </div>
      </div>
    </div>
  );
}
