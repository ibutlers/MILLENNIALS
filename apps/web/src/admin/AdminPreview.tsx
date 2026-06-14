import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
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
    target_amount_cents: number;
    committed_amount_cents: number;
    minimum_investment_cents: number;
    estimated_term_months: number;
    target_return_type: string | null;
    target_return_bps: number | null;
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

const CENTS_TO_EUR = (c: number | undefined) => c ? `€${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: 0 })}` : '—';
const BPS_TO_PCT = (b: number | undefined | null) => b != null ? `${(b / 100).toFixed(1)}%` : '—';
const RISK_LABELS: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', very_high: 'Muy alto' };

export default function AdminPreview() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdminOrOp = user?.roles?.some((r) => ['admin', 'operator'].includes(r));

  const { data, isLoading, error } = useQuery<PreviewResponse>({
    queryKey: ['admin', 'preview', id],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities/${id}/preview`),
    enabled: !!id && !!isAdminOrOp,
  });

  if (isLoading) return <div className="animate-pulse p-8 text-[#9B7E5F]">Cargando vista previa…</div>;
  if (error || !data) return <div className="p-8 text-[#9B7E5F]">No se pudo cargar la vista previa.</div>;

  const opp = data.data;
  const primaryImg = opp.media?.find((m) => m.type === 'primary') || opp.media?.[0];

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      {/* Preview banner */}
      <div className="sticky top-0 z-40 bg-[#9B7E5F] px-4 py-2 text-center text-sm font-medium text-[#08191C]">
        ⚠️ Vista previa privada — no compartir públicamente
        <Link to={`/admin/oportunidades/${id}`} className="ml-4 underline hover:no-underline">Volver al editor</Link>
      </div>

      {/* Hero */}
      <header className="relative bg-[#08191C]">
        {primaryImg && (
          <div className="absolute inset-0 opacity-40">
            {/* In a real app, this would render the image */}
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

        {/* Highlights */}
        {opp.highlights?.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-[#08191C]">Puntos destacados</h2>
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
          <h2 className="font-serif text-2xl text-[#08191C]">Métricas financieras</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-[#9B7E5F]">Capital objetivo</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.target_amount_cents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Comprometido</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.committed_amount_cents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Ticket mínimo</p><p className="text-xl font-medium text-[#08191C]">{CENTS_TO_EUR(opp.minimum_investment_cents)}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Plazo estimado</p><p className="text-xl font-medium text-[#08191C]">{opp.estimated_term_months} meses</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Tipo de retorno</p><p className="text-xl font-medium text-[#08191C]">{opp.target_return_type || '—'}</p></div>
            <div><p className="text-sm text-[#9B7E5F]">Retorno objetivo</p><p className="text-xl font-medium text-[#08191C]">{BPS_TO_PCT(opp.target_return_bps)}</p></div>
          </div>
        </section>

        {/* Risk */}
        <section className="rounded border border-[#08191C]/10 bg-white p-6">
          <h2 className="font-serif text-2xl text-[#08191C]">Riesgo</h2>
          <p className="mt-2 text-[#08191C]/80">Nivel: {RISK_LABELS[opp.risk_level] || opp.risk_level}</p>
        </section>

        {/* Risks */}
        {opp.risks?.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl text-[#08191C]">Riesgos identificados</h2>
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
            <h2 className="font-serif text-2xl text-[#08191C]">Hitos</h2>
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

        {/* Meta footer */}
        <footer className="border-t border-[#08191C]/10 pt-6 text-xs text-[#9B7E5F]">
          <p>Esta es una vista previa privada del panel administrativo de Realstate. No indexar. No compartir.</p>
          <p className="mt-1">Editorial: {opp.editorial_status} · Visibilidad: {opp.visibility} · Estado: {opp.status}</p>
        </footer>
      </main>
    </div>
  );
}
