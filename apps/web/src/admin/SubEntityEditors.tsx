import { useState } from 'react';

interface Identifiable { _id: string }

function makeId(): string { return crypto.randomUUID(); }

// ── Reorder helper ──
function reorder<T extends Identifiable>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, i) => ({ ...item, position: i }));
}

// ── Reorder buttons ──
function ReorderButtons({ index, total, onMove }: { index: number; total: number; onMove: (from: number, to: number) => void }) {
  return (
    <span className="flex gap-0.5">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)}
        className="rounded bg-[#1A3E48] px-1.5 py-0.5 text-xs text-[#FBF7F0] hover:bg-[#0F2A30] disabled:opacity-30" aria-label="Subir">
        ↑
      </button>
      <button type="button" disabled={index >= total - 1} onClick={() => onMove(index, index + 1)}
        className="rounded bg-[#1A3E48] px-1.5 py-0.5 text-xs text-[#FBF7F0] hover:bg-[#0F2A30] disabled:opacity-30" aria-label="Bajar">
        ↓
      </button>
    </span>
  );
}

// ══════════════════════════════════════
// Highlights Editor
// ══════════════════════════════════════
export interface HighlightItem extends Identifiable { label: string; value: string; position: number }

export function HighlightsEditor({ items, onChange }: { items: HighlightItem[]; onChange: (items: HighlightItem[]) => void }) {
  function add() {
    onChange([...items, { _id: makeId(), label: '', value: '', position: items.length }]);
  }
  function update(id: string, field: 'label' | 'value', val: string) {
    onChange(items.map((h) => (h._id === id ? { ...h, [field]: val } : h)));
  }
  function remove(id: string) {
    onChange(items.filter((h) => h._id !== id).map((h, i) => ({ ...h, position: i })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-[#7FA88C]">Highlights</h3>
        <button type="button" onClick={add} className="rounded bg-[#7FA88C] px-3 py-1 text-xs font-medium text-[#08191C] hover:bg-[#5C8D7A]">+ Añadir</button>
      </div>
      {items.length === 0 && <p className="text-sm text-[#5C8D7A]">Sin highlights. Añade puntos destacados de la oportunidad.</p>}
      {items.map((h, i) => (
        <div key={h._id} className="flex items-start gap-2 rounded border border-[#1A3E48] bg-[#0F2A30] p-3">
          <ReorderButtons index={i} total={items.length} onMove={(f, t) => onChange(reorder(items, f, t))} />
          <div className="flex-1 space-y-2">
            <input value={h.label} onChange={(e) => update(h._id, 'label', e.target.value)} placeholder="Etiqueta" maxLength={200}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <input value={h.value} onChange={(e) => update(h._id, 'value', e.target.value)} placeholder="Valor" maxLength={500}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
          </div>
          <button type="button" onClick={() => remove(h._id)} className="rounded p-1 text-[#9B7E5F] hover:bg-[#1A3E48]" aria-label="Eliminar highlight">✕</button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// Risks Editor
// ══════════════════════════════════════
export interface RiskItem extends Identifiable { title: string; description: string; position: number }

export function RisksEditor({ items, onChange }: { items: RiskItem[]; onChange: (items: RiskItem[]) => void }) {
  function add() {
    onChange([...items, { _id: makeId(), title: '', description: '', position: items.length }]);
  }
  function update(id: string, field: 'title' | 'description', val: string) {
    onChange(items.map((r) => (r._id === id ? { ...r, [field]: val } : r)));
  }
  function remove(id: string) {
    onChange(items.filter((r) => r._id !== id).map((r, i) => ({ ...r, position: i })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-[#7FA88C]">Riesgos <span className="text-xs text-[#9B7E5F]">(mín. 1 para publicar)</span></h3>
        <button type="button" onClick={add} className="rounded bg-[#7FA88C] px-3 py-1 text-xs font-medium text-[#08191C] hover:bg-[#5C8D7A]">+ Añadir</button>
      </div>
      {items.length === 0 && <p className="text-sm text-[#9B7E5F]">Se requiere al menos un riesgo para publicar.</p>}
      {items.map((r, i) => (
        <div key={r._id} className="flex items-start gap-2 rounded border border-[#1A3E48] bg-[#0F2A30] p-3">
          <ReorderButtons index={i} total={items.length} onMove={(f, t) => onChange(reorder(items, f, t))} />
          <div className="flex-1 space-y-2">
            <input value={r.title} onChange={(e) => update(r._id, 'title', e.target.value)} placeholder="Título del riesgo" maxLength={200}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <textarea value={r.description} onChange={(e) => update(r._id, 'description', e.target.value)} placeholder="Descripción" maxLength={2000} rows={2}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
          </div>
          <button type="button" onClick={() => remove(r._id)} className="rounded p-1 text-[#9B7E5F] hover:bg-[#1A3E48]" aria-label="Eliminar riesgo">✕</button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// Milestones Editor
// ══════════════════════════════════════
export interface MilestoneItem extends Identifiable { title: string; description: string; plannedDate: string; completedAt: string; position: number }

export function MilestonesEditor({ items, onChange }: { items: MilestoneItem[]; onChange: (items: MilestoneItem[]) => void }) {
  function add() {
    onChange([...items, { _id: makeId(), title: '', description: '', plannedDate: '', completedAt: '', position: items.length }]);
  }
  function update(id: string, field: string, val: string) {
    onChange(items.map((m) => (m._id === id ? { ...m, [field]: val } : m)));
  }
  function remove(id: string) {
    onChange(items.filter((m) => m._id !== id).map((m, i) => ({ ...m, position: i })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-[#7FA88C]">Hitos</h3>
        <button type="button" onClick={add} className="rounded bg-[#7FA88C] px-3 py-1 text-xs font-medium text-[#08191C] hover:bg-[#5C8D7A]">+ Añadir</button>
      </div>
      {items.length === 0 && <p className="text-sm text-[#5C8D7A]">Sin hitos definidos.</p>}
      {items.map((m, i) => (
        <div key={m._id} className={`flex items-start gap-2 rounded border p-3 ${m.completedAt ? 'border-[#7FA88C] bg-[#0F2A30]' : 'border-[#1A3E48] bg-[#0F2A30]'}`}>
          <ReorderButtons index={i} total={items.length} onMove={(f, t) => onChange(reorder(items, f, t))} />
          <div className="flex-1 space-y-2">
            <input value={m.title} onChange={(e) => update(m._id, 'title', e.target.value)} placeholder="Título del hito" maxLength={200}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <textarea value={m.description} onChange={(e) => update(m._id, 'description', e.target.value)} placeholder="Descripción" maxLength={2000} rows={2}
              className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-[#9B7E5F]">Fecha prevista
                <input type="date" value={m.plannedDate} onChange={(e) => update(m._id, 'plannedDate', e.target.value)}
                  className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="flex-1 text-xs text-[#9B7E5F]">Completado
                <input type="date" value={m.completedAt} onChange={(e) => update(m._id, 'completedAt', e.target.value)}
                  className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
            </div>
          </div>
          <button type="button" onClick={() => remove(m._id)} className="rounded p-1 text-[#9B7E5F] hover:bg-[#1A3E48]" aria-label="Eliminar hito">✕</button>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
// Media Editor
// ══════════════════════════════════════
import { CATALOG, type AssetEntry } from './assetCatalog';

export interface MediaItem extends Identifiable { assetId: string; alt: string; primary: boolean; position: number }

export function MediaEditor({ items, onChange }: { items: MediaItem[]; onChange: (items: MediaItem[]) => void }) {
  const [showCatalog, setShowCatalog] = useState(false);

  function addFromCatalog(asset: AssetEntry) {
    onChange([...items, { _id: makeId(), assetId: asset.id, alt: asset.alt, primary: items.length === 0, position: items.length }]);
    setShowCatalog(false);
  }
  function remove(id: string) {
    onChange(items.filter((m) => m._id !== id).map((m, i) => ({ ...m, position: i })));
  }
  function setPrimary(id: string) {
    onChange(items.map((m) => ({ ...m, primary: m._id === id })));
  }
  function updateAlt(id: string, alt: string) {
    onChange(items.map((m) => (m._id === id ? { ...m, alt } : m)));
  }

  const getAsset = (id: string) => CATALOG.find((a) => a.id === id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-[#7FA88C]">Media</h3>
        <button type="button" onClick={() => setShowCatalog(true)} className="rounded bg-[#7FA88C] px-3 py-1 text-xs font-medium text-[#08191C] hover:bg-[#5C8D7A]">+ Añadir imagen</button>
      </div>

      {/* Catalog modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCatalog(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded border border-[#1A3E48] bg-[#08191C] p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-serif text-lg text-[#FBF7F0] mb-4">Seleccionar imagen del catálogo</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CATALOG.map((asset) => (
                <button key={asset.id} type="button" onClick={() => addFromCatalog(asset)}
                  className="rounded border border-[#1A3E48] bg-[#0F2A30] p-3 text-left hover:border-[#7FA88C] focus:border-[#7FA88C] focus:outline-none">
                  <p className="text-xs font-medium text-[#FBF7F0]">{asset.id}</p>
                  <p className="text-xs text-[#5C8D7A]">{asset.width}×{asset.height}</p>
                  <p className="mt-1 text-xs text-[#5C8D7A] truncate">{asset.alt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-sm text-[#5C8D7A]">Sin imágenes. Añade al menos una imagen principal.</p>}

      {items.map((m, i) => {
        const asset = getAsset(m.assetId);
        return (
          <div key={m._id} className={`flex items-start gap-2 rounded border p-3 ${m.primary ? 'border-[#7FA88C] bg-[#0F2A30]' : 'border-[#1A3E48] bg-[#0F2A30]'}`}>
            <ReorderButtons index={i} total={items.length} onMove={(f, t) => onChange(reorder(items, f, t))} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#FBF7F0]">{asset?.id || m.assetId}</span>
                {m.primary && <span className="rounded bg-[#7FA88C] px-1.5 py-0.5 text-xs font-medium text-[#08191C]">Principal</span>}
                {!m.primary && <button type="button" onClick={() => setPrimary(m._id)} className="text-xs text-[#7FA88C] hover:underline">Marcar principal</button>}
              </div>
              <input value={m.alt} onChange={(e) => updateAlt(m._id, e.target.value)} placeholder="Texto alternativo" maxLength={500}
                className="block w-full rounded border border-[#1A3E48] bg-[#08191C] px-2 py-1 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
              {asset && <p className="text-xs text-[#5C8D7A]">{asset.width}×{asset.height} · {asset.mime}</p>}
            </div>
            <button type="button" onClick={() => remove(m._id)} className="rounded p-1 text-[#9B7E5F] hover:bg-[#1A3E48]" aria-label="Quitar imagen">✕</button>
          </div>
        );
      })}
    </div>
  );
}
