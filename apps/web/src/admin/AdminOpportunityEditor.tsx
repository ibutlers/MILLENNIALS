/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState, useEffect } from 'react';

interface OppFull {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  city: string;
  country_code: string;
  district: string | null;
  asset_type: string;
  strategy: string;
  editorial_status: string;
  visibility: string;
  status: string;
  currency: string;
  target_amount_cents: number;
  committed_amount_cents: number;
  minimum_investment_cents: number;
  estimated_term_months: number;
  target_return_type: string | null;
  target_return_bps: number | null;
  risk_level: string;
  closing_date: string | null;
  disclaimer: string | null;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const SECTION_NAMES = ['general', 'localizacion', 'estrategia', 'financieras', 'riesgo', 'descripcion'];

export default function AdminOpportunityEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState<{ currentVersion: number; providedVersion: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('general');

  const { data, isLoading, error } = useQuery<{ data: OppFull }>({
    queryKey: ['admin', 'opportunities', id],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}`),
    enabled: !isNew,
  });

  useEffect(() => {
    if (data?.data) {
      const opp = data.data;
      setForm({
        title: opp.title || '',
        slug: opp.slug || '',
        shortDescription: opp.short_description || '',
        description: opp.description || '',
        city: opp.city || '',
        countryCode: opp.country_code || 'ES',
        district: opp.district || '',
        assetType: opp.asset_type || '',
        strategy: opp.strategy || '',
        editorialStatus: opp.editorial_status || 'draft',
        visibility: opp.visibility || 'private',
        status: opp.status || 'coming_soon',
        currency: opp.currency || 'EUR',
        targetAmountCents: opp.target_amount_cents || 0,
        committedAmountCents: opp.committed_amount_cents || 0,
        minimumInvestmentCents: opp.minimum_investment_cents || 0,
        estimatedTermMonths: opp.estimated_term_months || 12,
        targetReturnType: opp.target_return_type || '',
        targetReturnBps: opp.target_return_bps || 0,
        riskLevel: opp.risk_level || 'medium',
        closingDate: opp.closing_date ? opp.closing_date.slice(0, 10) : '',
        disclaimer: opp.disclaimer || '',
        version: opp.version,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      apiFetch(`/api/v1/admin/opportunities/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (resp: any) => {
      setDirty(false);
      setConflict(null);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
      if (resp?.data) {
        setForm((prev) => ({ ...prev, version: resp.data.version }));
      }
    },
    onError: (err: any) => {
      if (err?.code === 'version_conflict') {
        setConflict({ currentVersion: err.currentVersion, providedVersion: err.providedVersion });
      } else {
        setSaveError(err?.message || 'Error al guardar.');
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      apiFetch('/api/v1/admin/opportunities', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (resp: any) => {
      if (resp?.data?.id) {
        navigate(`/admin/oportunidades/${resp.data.id}`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] });
    },
  });

  function setField(field: string, value: any) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    if (isNew) {
      createMutation.mutate(form);
    } else {
      saveMutation.mutate({ ...form, version: (data?.data as OppFull)?.version });
    }
  }

  // Warn on leave
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const EUR_TO_CENTS = (eur: number) => Math.round(eur * 100);
  const CENTS_TO_EUR = (cents: number) => (cents / 100).toFixed(2);
  const BPS_TO_PCT = (bps: number) => (bps / 100).toFixed(2);

  if (isLoading) return <div className="animate-pulse text-[#9B7E5F]">Cargando oportunidad…</div>;
  if (error && !isNew) return <div className="text-[#9B7E5F]">Error al cargar la oportunidad.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-[#FBF7F0]">{isNew ? 'Nueva oportunidad' : 'Editar oportunidad'}</h2>
        <Link to="/admin/oportunidades" className="text-sm text-[#7FA88C] hover:underline">← Volver al listado</Link>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">
          <p className="font-medium">Conflicto de versión</p>
          <p className="mt-1 text-sm">Otro usuario modificó esta oportunidad. Recarga para ver los cambios más recientes.</p>
          <button onClick={() => window.location.reload()} className="mt-2 rounded bg-[#7FA88C] px-3 py-1 text-sm text-[#08191C]">
            Recargar
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">{saveError}</div>
      )}

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#1A3E48]">
        {SECTION_NAMES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeSection === s
                ? 'border-b-2 border-[#7FA88C] text-[#7FA88C]'
                : 'text-[#9B7E5F] hover:text-[#FBF7F0]'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Form sections */}
      <div className="rounded border border-[#1A3E48] bg-[#08191C] p-6">
        {activeSection === 'general' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Información general</h3>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Título *</span>
              <input value={form.title || ''} onChange={(e) => setField('title', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Slug</span>
              <input value={form.slug || ''} onChange={(e) => setField('slug', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none font-mono text-sm" />
            </label>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Descripción breve</span>
              <textarea value={form.shortDescription || ''} onChange={(e) => setField('shortDescription', e.target.value)} rows={2} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
            </label>
          </div>
        )}

        {activeSection === 'localizacion' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Localización</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Ciudad</span>
                <input value={form.city || ''} onChange={(e) => setField('city', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Código país</span>
                <input value={form.countryCode || ''} onChange={(e) => setField('countryCode', e.target.value)} maxLength={2} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none uppercase" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Distrito</span>
              <input value={form.district || ''} onChange={(e) => setField('district', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
            </label>
          </div>
        )}

        {activeSection === 'estrategia' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Tipo de activo y estrategia</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Tipo de activo</span>
                <input value={form.assetType || ''} onChange={(e) => setField('assetType', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Estrategia</span>
                <input value={form.strategy || ''} onChange={(e) => setField('strategy', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Estado editorial</span>
                <select value={form.editorialStatus || 'draft'} onChange={(e) => setField('editorialStatus', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                  <option value="draft">Borrador</option><option value="review">Revisión</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Visibilidad</span>
                <select value={form.visibility || 'private'} onChange={(e) => setField('visibility', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                  <option value="private">Privado</option><option value="public">Público</option><option value="unlisted">No listado</option><option value="draft">Borrador</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Estado comercial</span>
                <select value={form.status || ''} onChange={(e) => setField('status', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                  <option value="coming_soon">Próximamente</option><option value="open">Abierto</option><option value="funding">Financiación</option><option value="funded">Financiado</option><option value="in_execution">En ejecución</option><option value="commercializing">Comercializando</option><option value="closed">Cerrado</option><option value="cancelled">Cancelado</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {activeSection === 'financieras' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Métricas financieras</h3>
            <p className="text-xs text-[#5C8D7A]">Los importes se introducen en euros y se convierten a céntimos. Los porcentajes se convierten a basis points.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Capital objetivo (€)</span>
                <input type="number" min="0" step="0.01" value={form.targetAmountCents ? CENTS_TO_EUR(form.targetAmountCents) : '0.00'} onChange={(e) => setField('targetAmountCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Capital comprometido (€)</span>
                <input type="number" min="0" step="0.01" value={form.committedAmountCents ? CENTS_TO_EUR(form.committedAmountCents) : '0.00'} onChange={(e) => setField('committedAmountCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Ticket mínimo (€)</span>
                <input type="number" min="0" step="0.01" value={form.minimumInvestmentCents ? CENTS_TO_EUR(form.minimumInvestmentCents) : '0.00'} onChange={(e) => setField('minimumInvestmentCents', EUR_TO_CENTS(parseFloat(e.target.value) || 0))} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Plazo estimado (meses)</span>
                <input type="number" min="1" max="360" value={form.estimatedTermMonths || 12} onChange={(e) => setField('estimatedTermMonths', parseInt(e.target.value) || 0)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Tipo de retorno</span>
                <select value={form.targetReturnType || ''} onChange={(e) => setField('targetReturnType', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                  <option value="">Sin especificar</option>
                  <option value="target_annual_return">Retorno anual objetivo</option>
                  <option value="target_total_return">Retorno total objetivo</option>
                  <option value="target_irr">TIR objetivo</option>
                  <option value="target_roi">ROI objetivo</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#9B7E5F]">Retorno objetivo (%)</span>
                <input type="number" min="0" max="1000" step="0.01" value={form.targetReturnBps ? BPS_TO_PCT(form.targetReturnBps) : ''} onChange={(e) => setField('targetReturnBps', Math.round((parseFloat(e.target.value) || 0) * 100))} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Moneda</span>
              <input value={form.currency || 'EUR'} onChange={(e) => setField('currency', e.target.value)} maxLength={3} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none uppercase w-24" />
            </label>
          </div>
        )}

        {activeSection === 'riesgo' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Riesgo</h3>
            <p className="text-xs text-[#5C8D7A]">Esta clasificación no constituye una valoración regulatoria oficial.</p>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Nivel de riesgo</span>
              <select value={form.riskLevel || 'medium'} onChange={(e) => setField('riskLevel', e.target.value)} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                <option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option><option value="very_high">Muy alto</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Fecha de cierre</span>
              <input type="date" value={form.closingDate || ''} onChange={(e) => setField('closingDate', e.target.value)} className="mt-1 block rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
            </label>
          </div>
        )}

        {activeSection === 'descripcion' && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-[#7FA88C]">Descripción y tesis</h3>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Descripción</span>
              <textarea value={form.description || ''} onChange={(e) => setField('description', e.target.value)} rows={6} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-sm text-[#9B7E5F]">Disclaimer</span>
              <textarea value={form.disclaimer || ''} onChange={(e) => setField('disclaimer', e.target.value)} rows={3} className="mt-1 block w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none text-sm" />
            </label>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {dirty && <span className="text-sm text-[#9B7E5F]">Cambios sin guardar</span>}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || createMutation.isPending}
            className="rounded bg-[#7FA88C] px-6 py-2.5 font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50 focus:outline-2 focus:outline-[#7FA88C]"
          >
            {saveMutation.isPending || createMutation.isPending ? 'Guardando…' : (isNew ? 'Crear borrador' : 'Guardar cambios')}
          </button>
        </div>
        {id && (
          <span className="text-xs text-[#5C8D7A]">Versión {data?.data?.version || '—'}</span>
        )}
      </div>
    </div>
  );
}
