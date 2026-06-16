import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchPublicOpportunities, type OpportunityListParams } from './api';
import { OpportunityCard } from './components';

const statuses = [
  ['','Todos los estados'], ['coming_soon','Próximamente'], ['open','Abierta'], ['funding','En financiación'], ['funded','Financiada'], ['in_execution','En ejecución'], ['in_study','En estudio'], ['commercializing','En comercialización'], ['closed','Cerrada']
];
const risks = [['','Todos los riesgos'], ['low','Bajo'], ['medium','Medio'], ['high','Alto'], ['very_high','Muy alto']];
const cities = [['','Todas las ciudades'], ['Vigo','Vigo'], ['Barcelona','Barcelona'], ['Madrid','Madrid'], ['Valencia','Valencia'], ['Málaga','Málaga']];
const assetTypes = [['','Todos los activos'], ['Residencial','Residencial'], ['Logístico','Logístico'], ['Retail urbano','Retail urbano'], ['Coliving','Coliving']];
const strategies = [['','Todas las estrategias'], ['Promoción residencial','Promoción residencial'], ['Cambio de uso','Cambio de uso'], ['Rehabilitación energética','Rehabilitación energética'], ['Reposicionamiento','Reposicionamiento'], ['Renta estabilizada','Renta estabilizada'], ['Desarrollo ligero','Desarrollo ligero']];
const sorts = [['publishedAt','Publicación'], ['closingDate','Cierre'], ['fundingProgress','Progreso'], ['minimumInvestment','Ticket mínimo'], ['targetAmount','Capital objetivo']];
const directions = [['desc','Descendente'], ['asc','Ascendente']];
const pageSize = 6;

function readParams(searchParams: URLSearchParams): OpportunityListParams {
  const offset = Number(searchParams.get('offset') ?? 0);
  return {
    status: searchParams.get('status') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    assetType: searchParams.get('assetType') ?? undefined,
    strategy: searchParams.get('strategy') ?? undefined,
    riskLevel: searchParams.get('riskLevel') ?? undefined,
    sort: searchParams.get('sort') ?? 'publishedAt',
    direction: (searchParams.get('direction') === 'asc' ? 'asc' : 'desc'),
    limit: pageSize,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0
  };
}

function SelectField({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-ink" htmlFor={name}>
      <span>{label}</span>
      <select id={name} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-lg border border-frost bg-white px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

export function OpportunitiesCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    setPageMetadata('Catálogo de proyectos | MILLENNIALS CONSTRUYEN', 'Proyectos inmobiliarios de MILLENNIALS CONSTRUYEN con información pública preliminar.');
  }, []);
  const params = readParams(searchParams);
  const query = useQuery({
    queryKey: ['opportunities', params],
    queryFn: ({ signal }) => fetchPublicOpportunities(signal, params),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  });

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    next.delete('offset');
    setSearchParams(next, { replace: false });
  }

  function page(delta: number) {
    const next = new URLSearchParams(searchParams);
    const current = params.offset ?? 0;
    const newOffset = Math.max(0, current + delta);
    if (newOffset) next.set('offset', String(newOffset)); else next.delete('offset');
    setSearchParams(next);
  }

  const currentOffset = params.offset ?? 0;

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <main id="contenido" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="breadcrumb" className="text-sm text-charcoal/60"><Link className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" to="/">Inicio</Link> <span aria-hidden="true">/</span> <span>Oportunidades</span></nav>
        <section className="grid gap-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Catálogo público</p>
            <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.045em] sm:text-7xl">Catálogo de proyectos inmobiliarios.</h1>
          </div>
          <div className="space-y-4">
            <p className="text-lg leading-8 text-charcoal/80">Consulta los proyectos públicos de MILLENNIALS CONSTRUYEN. La información es preliminar y no incluye documentos privados ni permite invertir.</p>
            <p className="rounded-lg border border-frost bg-white p-4 text-sm leading-6 text-charcoal/80">La información publicada tiene carácter informativo y preliminar. Las operaciones en estudio pueden sufrir modificaciones y su publicación no constituye una oferta de inversión.</p>
          </div>
        </section>

        <section aria-label="Filtros del catálogo" className="grid gap-4 rounded-lg border border-frost bg-white p-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SelectField label="Estado" name="status" value={params.status ?? ''} options={statuses} onChange={(value) => updateParam('status', value)} />
          <SelectField label="Ciudad" name="city" value={params.city ?? ''} options={cities} onChange={(value) => updateParam('city', value)} />
          <SelectField label="Tipo de activo" name="assetType" value={params.assetType ?? ''} options={assetTypes} onChange={(value) => updateParam('assetType', value)} />
          <SelectField label="Estrategia" name="strategy" value={params.strategy ?? ''} options={strategies} onChange={(value) => updateParam('strategy', value)} />
          <SelectField label="Riesgo" name="riskLevel" value={params.riskLevel ?? ''} options={risks} onChange={(value) => updateParam('riskLevel', value)} />
          <SelectField label="Ordenar" name="sort" value={params.sort ?? 'publishedAt'} options={sorts} onChange={(value) => updateParam('sort', value)} />
          <SelectField label="Dirección" name="direction" value={params.direction ?? 'desc'} options={directions} onChange={(value) => updateParam('direction', value)} />
        </section>

        <section className="mt-8" aria-live="polite">
          {query.isLoading ? <div className="rounded-lg border border-frost bg-white p-8 text-charcoal/60" role="status">Cargando catálogo público…</div> : null}
          {query.isError ? <div className="rounded-lg border border-warning/40 bg-warning/5 p-8 text-charcoal/80" role="alert">No hemos podido cargar el catálogo. No mostramos proyectos falsos si la API no responde.</div> : null}
          {query.data && query.data.data.length === 0 ? <div className="rounded-lg border border-frost bg-white p-8 text-charcoal/60">No hay proyectos públicos para estos filtros.</div> : null}
          {query.data && query.data.data.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-charcoal/60"><span>{query.data.pagination.total} proyectos públicos</span><span>{query.isPlaceholderData ? 'Actualizando resultados…' : query.data.meta.disclaimer}</span></div>
              <div className="grid gap-5">{query.data.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}</div>
              <div className="mt-8 flex items-center justify-between gap-4">
                <button type="button" disabled={currentOffset === 0} onClick={() => page(-pageSize)} className="rounded-lg border border-frost px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Anterior</button>
                <span className="text-sm text-charcoal/60">Página {Math.floor(currentOffset / pageSize) + 1}</span>
                <button type="button" disabled={!query.data.pagination.hasMore} onClick={() => page(pageSize)} className="rounded-lg border border-frost px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Siguiente</button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
