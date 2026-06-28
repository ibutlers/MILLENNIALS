import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/context';

interface PreviewResponse {
  data: {
    title: string;
    slug: string;
    description: string;
    short_description: string;
    city: string;
    country_code: string;
    district: string | null;
    asset_type: string;
    strategy: string;
    editorial_status: string;
    visibility: string;
    status: string;
    currency: string;
    target_amount_cents: number | string;
    committed_amount_cents: number | string;
    project_total_amount_cents: number | string | null;
    bank_financing_amount_cents: number | string | null;
    minimum_investment_cents: number | string;
    estimated_term_months: number | string;
    target_return_type: string | null;
    target_return_bps: number | string | null;
    risk_level: string;
    closing_date: string | null;
    disclaimer: string | null;
    highlights: Array<{ label: string; value: string; position: number }>;
    risks: Array<{ title: string; description: string; position: number }>;
    milestones: Array<{ title: string; description: string; planned_date: string | null; completed_at: string | null; position: number }>;
    media: Array<{ type: string; url: string; alt_text: string; position: number }>;
  };
  meta: { preview: boolean; message: string };
}

interface VersionEntry {
  version: number;
  editorial_status: string;
  created_at: string;
  updated_at: string;
}

interface VersionsResponse {
  data: VersionEntry[];
}

type LocalOverrides = Partial<{
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  city: string;
  countryCode: string;
  district: string;
  assetType: string;
  strategy: string;
  editorialStatus: string;
  visibility: string;
  status: string;
  currency: string;
  targetAmountCents: number;
  committedAmountCents: number;
  projectTotalAmountCents: number;
  bankFinancingAmountCents: number;
  minimumInvestmentCents: number;
  estimatedTermMonths: number;
  targetReturnType: string;
  targetReturnBps: number;
  riskLevel: string;
  closingDate: string;
  disclaimer: string;
}>;

interface AdminPreviewProps {
  localOverrides?: LocalOverrides | null;
}

const toNumber = (value: number | string | null | undefined, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const CENTS_TO_EUR = (c: number | string | null | undefined) => toNumber(c) ? `€${(toNumber(c) / 100).toLocaleString('es-ES', { minimumFractionDigits: 0 })}` : '—';
const BPS_TO_PCT = (b: number | string | undefined | null) => b != null ? `${(toNumber(b) / 100).toFixed(1)}%` : '—';
const RISK_LABELS: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', very_high: 'Muy alto' };

export default function AdminPreview({ localOverrides }: AdminPreviewProps = {}) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdminOrOp = user?.roles?.some((r) => ['admin', 'operator'].includes(r));

  const [versionsOpen, setVersionsOpen] = useState(false);

  const { data, isLoading, error } = useQuery<PreviewResponse>({
    queryKey: ['admin', 'preview', id],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}/preview`),
    enabled: !!id && !!isAdminOrOp,
  });

  const { data: versionsData } = useQuery<VersionsResponse>({
    queryKey: ['admin', 'opportunities', id, 'versions'],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}/versions`),
    enabled: !!id && versionsOpen && !!isAdminOrOp,
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      apiFetch(`/api/v1/admin/opportunities/${id}/versions/${version}/restore`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'preview', id] });
    },
  });

  // Apply local overrides to preview data
  function applyOverrides(opp: PreviewResponse['data']): PreviewResponse['data'] {
    if (!localOverrides) return opp;
    return {
      ...opp,
      title: localOverrides.title ?? opp.title,
      slug: localOverrides.slug ?? opp.slug,
      description: localOverrides.description ?? opp.description,
      short_description: localOverrides.shortDescription ?? opp.short_description,
      city: localOverrides.city ?? opp.city,
      country_code: localOverrides.countryCode ?? opp.country_code,
      district: localOverrides.district !== undefined ? localOverrides.district : opp.district,
      asset_type: localOverrides.assetType ?? opp.asset_type,
      strategy: localOverrides.strategy ?? opp.strategy,
      editorial_status: localOverrides.editorialStatus ?? opp.editorial_status,
      visibility: localOverrides.visibility ?? opp.visibility,
      status: localOverrides.status ?? opp.status,
      currency: localOverrides.currency ?? opp.currency,
      target_amount_cents: localOverrides.targetAmountCents ?? opp.target_amount_cents,
      committed_amount_cents: localOverrides.committedAmountCents ?? opp.committed_amount_cents,
      project_total_amount_cents: localOverrides.projectTotalAmountCents ?? opp.project_total_amount_cents,
      bank_financing_amount_cents: localOverrides.bankFinancingAmountCents ?? opp.bank_financing_amount_cents,
      minimum_investment_cents: localOverrides.minimumInvestmentCents ?? opp.minimum_investment_cents,
      estimated_term_months: localOverrides.estimatedTermMonths ?? opp.estimated_term_months,
      target_return_type: localOverrides.targetReturnType !== undefined ? localOverrides.targetReturnType : opp.target_return_type,
      target_return_bps: localOverrides.targetReturnBps !== undefined ? localOverrides.targetReturnBps : opp.target_return_bps,
      risk_level: localOverrides.riskLevel ?? opp.risk_level,
      closing_date: localOverrides.closingDate !== undefined ? localOverrides.closingDate : opp.closing_date,
      disclaimer: localOverrides.disclaimer !== undefined ? localOverrides.disclaimer : opp.disclaimer,
    };
  }

  const hasOverrides = !!localOverrides && Object.keys(localOverrides).length > 0;

  if (isLoading) return <div className="animate-pulse p-8 text-[#9B7E5F]">Cargando vista previa…</div>;
  if (error || !data) return <div className="p-8 text-[#9B7E5F]">No se pudo cargar la vista previa.</div>;

  const opp = applyOverrides(data.data);
  const primaryImg = opp.media?.find((m) => m.type === 'primary') || opp.media?.[0];
  const projectTotalCents = toNumber(opp.project_total_amount_cents, toNumber(opp.target_amount_cents));
  const bankFinancingCents = toNumber(
    opp.bank_financing_amount_cents,
    Math.max(0, projectTotalCents - toNumber(opp.target_amount_cents)),
  );

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 bg-[#9B7E5F] px-4 py-2 text-center text-sm font-medium text-[#08191C]">
        ⚠️ Vista previa privada — no compartir públicamente
        <Link to={`/admin/oportunidades/${id}`} className="ml-4 underline hover:no-underline">Volver al editor</Link>
      </div>

      {/* Local overrides indicator */}
      {hasOverrides && (
        <div className="sticky top-10 z-40 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-[#08191C]">
          ⚡ Cambios sin guardar — esta vista previa incluye modificaciones locales no persistidas
        </div>
      )}

      {/* Hero */}
      <header className="relative bg-[#08191C]">
        {primaryImg && (
          <div className="absolute inset-0 opacity-40">
            <div className="h-full w-full bg-[#1A3E48]" />
          </div>
        )}
        <div className="relative z-10 px-6 py-20 text-center lg:py-32">
          <p className="font-serif text-sm tracking-widest text-[#7FA88C] uppercase">{opp.city}{opp.district ? ` · ${opp.district}` : ''}</p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight text-[#FBF7F0] lg:text-5xl">{opp.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#FBF7F0]/80">{opp.short_description}</p>
          <p className="mt-2 text-sm text-[#7FA88C]">Estado: {opp.editorial_status} · Visibilidad: {opp.visibility}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-16 px-6 py-12">
        {/* Description */}
        <section>
          <h2 className="font-serif text-2xl text-[#08191C]">Tesis de inversión</h2>
          <div className="mt-4 whitespace-pre-wrap text-[#08191C]/80 leading-relaxed">{opp.description || 'Sin descripción.'}</div>
        </section>

        {/* Datos de información */}
        {opp.highlights?.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-[#08191C]">Datos de información</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {opp.highlights.map((h, i) => (
                <div key={i} className="rounded border border-[#08191C]/10 bg-white p-4">
                  <dt className="text-sm text-[#9B7E5F]">{h.label}</dt>
                  <dd className="mt-1 text-lg font-medium text-[#08191C]">{h.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Strategy & Location */}
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded border border-[#08191C]/10 bg-white p-6">
            <h3 className="font-serif text-lg text-[#08191C]">Activo y estrategia</h3>
            <p className="mt-2 text-[#08191C]/80">{opp.asset_type || '—'} · {opp.strategy || '—'}</p>
          </div>
          <div className="rounded border border-[#08191C]/10 bg-white p-6">
            <h3 className="font-serif text-lg text-[#08191C]">Localización</h3>
            <p className="mt-2 text-[#08191C]/80">{opp.city}, {opp.country_code}{opp.district ? ` · ${opp.district}` : ''}</p>
          </div>
        </section>

        {/* Financials */}
        <section className="rounded border border-[#08191C]/10 bg-white p-6">
          <h2 className="font-serif text-2xl text-[#08191C]">Datos clave públicos</h2>
          <p className="mt-2 text-sm text-[#08191C]/60">Debe concordar con la ficha pública: Inversión, Retorno, Plazo, Ticket, CAPEX total y Financiación bancaria.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-[#9B7E5F]">Inversión</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.target_amount_cents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">CAPEX total</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(projectTotalCents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Financiación bancaria</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(bankFinancingCents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Ticket mínimo</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.minimum_investment_cents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Plazo estimado</p><p className="text-xl font-medium text-[#08191C]">{opp.estimated_term_months} meses</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Retorno estimado</p><p className="text-xl font-medium text-[#08191C]">{BPS_TO_PCT(opp.target_return_bps)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Comprometido</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.committed_amount_cents)}</p><p className="text-xs text-[#08191C]/55">Solo progreso público</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Tipo de retorno</p><p className="text-xl font-medium text-[#08191C]">{opp.target_return_type || '—'}</p></div>
          </div>
        </section>

        {/* Internal/admin risk */}
        <section className="rounded border border-[#08191C]/10 bg-white p-6">
          <h2 className="font-serif text-2xl text-[#08191C]">Riesgo interno/admin</h2>
          <p className="mt-2 text-[#08191C]/80">Nivel: {RISK_LABELS[opp.risk_level] || opp.risk_level}</p>
          <p className="mt-1 text-xs text-[#08191C]/55">No se muestra en la ficha pública simplificada.</p>
        </section>

        {/* Risks */}
        {opp.risks?.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-[#08191C]">Riesgos identificados <span className="text-sm font-normal text-[#08191C]/50">(backend/admin)</span></h2>
            <div className="mt-4 space-y-4">
              {opp.risks.map((r, i) => (
                <div key={i} className="rounded border border-[#08191C]/10 bg-white p-5">
                  <h3 className="font-medium text-[#08191C]">{r.title}</h3>
                  <p className="mt-1 text-[#08191C]/70">{r.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Milestones */}
        {opp.milestones?.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-[#08191C]">Hitos <span className="text-sm font-normal text-[#08191C]/50">(backend/admin)</span></h2>
            <div className="mt-4 space-y-3">
              {opp.milestones.map((m, i) => (
                <div key={i} className={`rounded border p-4 ${m.completed_at ? 'border-[#7FA88C] bg-white' : 'border-[#08191C]/10 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    {m.completed_at && <span className="text-[#7FA88C]">✓</span>}
                    <h3 className="font-medium text-[#08191C]">{m.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-[#08191C]/70">{m.description}</p>
                  <p className="mt-2 text-xs text-[#9B7E5F]">
                    {m.planned_date && `Previsto: ${new Date(m.planned_date).toLocaleDateString('es-ES')}`}
                    {m.completed_at && ` · Completado: ${new Date(m.completed_at).toLocaleDateString('es-ES')}`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        {opp.disclaimer && (
          <section className="rounded border border-[#9B7E5F]/30 bg-[#FBF7F0] p-6">
            <p className="text-sm text-[#08191C]/60">{opp.disclaimer}</p>
          </section>
        )}

        {/* Version history */}
        <section className="rounded border border-[#08191C]/10 bg-white p-6">
          <button
            onClick={() => setVersionsOpen(!versionsOpen)}
            className="flex w-full items-center justify-between font-serif text-lg text-[#08191C]"
          >
            <span>Historial de versiones</span>
            <span className={`transform transition-transform ${versionsOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {versionsOpen && (
            <div className="mt-4">
              {!versionsData && (
                <p className="text-sm text-[#9B7E5F] animate-pulse">Cargando versiones…</p>
              )}
              {versionsData?.data && versionsData.data.length === 0 && (
                <p className="text-sm text-[#9B7E5F]">No hay versiones anteriores.</p>
              )}
              {versionsData?.data && versionsData.data.length > 0 && (
                <div className="space-y-2">
                  {versionsData.data.map((v) => (
                    <div
                      key={v.version}
                      className="flex items-center justify-between rounded border border-[#08191C]/10 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#08191C]">
                          Versión {v.version}
                        </p>
                        <p className="text-xs text-[#9B7E5F]">
                          {v.editorial_status} ·{' '}
                          {new Date(v.updated_at).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreMutation.mutate(v.version)}
                        disabled={restoreMutation.isPending}
                        className="rounded border border-[#7FA88C] px-3 py-1.5 text-xs font-medium text-[#7FA88C] hover:bg-[#7FA88C] hover:text-white disabled:opacity-50 transition-colors"
                      >
                        {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar como borrador'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {restoreMutation.isSuccess && (
                <p className="mt-3 text-sm text-[#7FA88C]">
                  ✓ Versión restaurada. Vuelve al editor para continuar.
                </p>
              )}
              {restoreMutation.isError && (
                <p className="mt-3 text-sm text-red-500">
                  Error al restaurar: {(restoreMutation.error as Error)?.message || 'Error desconocido'}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Meta footer */}
        <footer className="border-t border-[#08191C]/10 pt-6 text-xs text-[#9B7E5F]">
          <p>Esta es una vista previa privada del panel administrativo de MILLENNIALS CONSTRUYEN. No indexar. No compartir.</p>
          <p className="mt-1">Editorial: {opp.editorial_status} · Visibilidad: {opp.visibility} · Estado: {opp.status}</p>
        </footer>
      </main>
    </div>
  );
}
