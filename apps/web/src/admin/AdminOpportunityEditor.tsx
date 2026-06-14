import { useEffect } from 'react';
import { Link } from 'react-router';
import { useEditorForm, SECTIONS } from './editor/useEditorForm';
import EditorShell from './editor/EditorShell';
import SaveBar from './editor/SaveBar';
import SectionGeneral from './editor/SectionGeneral';
import SectionLocation from './editor/SectionLocation';
import SectionStrategy from './editor/SectionStrategy';
import SectionStatus from './editor/SectionStatus';
import SectionFinancials from './editor/SectionFinancials';
import SectionDescription from './editor/SectionDescription';
import SectionReview from './editor/SectionReview';
import SectionHighlights from './editor/SectionHighlights';
import SectionRisks from './editor/SectionRisks';
import SectionMilestones from './editor/SectionMilestones';
import SectionMedia from './editor/SectionMedia';

export default function AdminOpportunityEditor() {
  const {
    form, setField, dirty, version,
    save, isSaving, lastSavedAt, conflict,
    saveError, saveStatus, clearSaveError,
    highlights, setHighlights,
    risks, setRisks,
    milestones, setMilestones,
    media, setMedia,
    publish, sendToReview, isPublishing, isSendingReview, canPublish,
    activeSection, handleSectionChange,
    mobileMenuOpen, setMobileMenuOpen,
    sectionErrors, isSectionDirty,
    validationErrors, showValidation,
    isLoading, error, isNew, id,
    activeSectionRef,
    subEntityCounts,
  } = useEditorForm();

  // ── Warn on leave ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ── Loading / error states ──
  if (isLoading) return <div className="animate-pulse p-8 text-[#9B7E5F]">Cargando oportunidad…</div>;
  if (error && !isNew) return <div className="p-8 text-[#9B7E5F]">Error al cargar la oportunidad.</div>;

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div aria-live="polite" aria-atomic="true" className="sr-only">{saveStatus}</div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1A3E48] shrink-0">
        <h2 className="font-serif text-xl text-[#FBF7F0]">
          {isNew ? 'Nueva oportunidad' : 'Editar oportunidad'}
        </h2>
        <div className="flex items-center gap-4">
          {!isNew && id && (
            <Link to={`/admin/oportunidades/${id}/preview`} className="text-sm text-[#7FA88C] hover:underline" target="_blank" rel="noopener noreferrer">
              Vista previa ↗
            </Link>
          )}
          <Link to="/admin/oportunidades" className="text-sm text-[#9B7E5F] hover:text-[#FBF7F0]">
            ← Volver al listado
          </Link>
        </div>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="mx-4 mt-3 rounded border border-[#9B7E5F] bg-[#0F2A30] p-3 text-[#9B7E5F] shrink-0">
          <p className="font-medium">Conflicto de versión</p>
          <p className="mt-1 text-sm">
            Otro usuario modificó esta oportunidad (versión actual: {conflict.currentVersion},
            tu versión: {conflict.providedVersion}). Recarga para ver los cambios más recientes.
          </p>
          <button onClick={() => window.location.reload()} className="mt-2 rounded bg-[#7FA88C] px-3 py-1.5 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A]">
            Recargar página
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="mx-4 mt-3 rounded border border-[#9B7E5F] bg-[#0F2A30] p-3 text-[#9B7E5F] shrink-0">
          {saveError}
          <button onClick={clearSaveError} className="ml-3 text-sm text-[#FBF7F0] hover:underline" aria-label="Cerrar error">✕</button>
        </div>
      )}

      <EditorShell
        sections={SECTIONS}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        errorSections={sectionErrors}
        dirtySections={isSectionDirty}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={setMobileMenuOpen}
      >
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-6" ref={activeSectionRef}>
            {activeSection === 'general' && <SectionGeneral values={form} onChange={setField} errors={validationErrors.general || []} showValidation={showValidation} />}
            {activeSection === 'location' && <SectionLocation values={form} onChange={setField} errors={validationErrors.location || []} showValidation={showValidation} />}
            {activeSection === 'assetStrategy' && <SectionStrategy values={form} onChange={setField} errors={validationErrors.assetStrategy || []} showValidation={showValidation} />}
            {activeSection === 'statusVisibility' && <SectionStatus values={form} onChange={setField} errors={validationErrors.statusVisibility || []} showValidation={showValidation} />}
            {activeSection === 'financials' && <SectionFinancials values={form} onChange={setField} errors={validationErrors.financials || []} showValidation={showValidation} />}
            {activeSection === 'description' && <SectionDescription values={form} onChange={setField} errors={validationErrors.description || []} showValidation={showValidation} />}
            {activeSection === 'highlights' && <SectionHighlights items={highlights} onChange={setHighlights} />}
            {activeSection === 'risks' && <SectionRisks items={risks} onChange={setRisks} errors={validationErrors.risks} showValidation={showValidation} />}
            {activeSection === 'milestones' && <SectionMilestones items={milestones} onChange={setMilestones} />}
            {activeSection === 'media' && <SectionMedia items={media} onChange={setMedia} errors={validationErrors.media} showValidation={showValidation} />}
            {activeSection === 'review' && (
              <SectionReview
                formData={form}
                highlights={highlights}
                risks={risks}
                media={media}
                subEntityCounts={subEntityCounts}
                milestonesCount={milestones.length}
                isAdmin={canPublish}
                isNew={isNew}
                isPublishing={isPublishing}
                isSendingReview={isSendingReview}
                onPublish={publish}
                onSendToReview={sendToReview}
              />
            )}
          </div>
          <SaveBar onSave={save} isSaving={isSaving} isDirty={dirty} isNew={isNew} version={version} lastSavedAt={lastSavedAt} saveStatus={saveStatus} conflict={conflict} />
        </div>
      </EditorShell>
    </div>
  );
}
