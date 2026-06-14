import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchPublicOpportunities, type OpportunityListParams } from './api';
import { OpportunityCard } from './components';

const statuses = [
  ['','Todos los estados'], ['coming_soon','Próximamente'], ['open','Abierta'], ['funding','En financiación'], ['funded','Financiada'], ['in_execution','En ejecución'], ['commercializing','En comercialización'], ['closed','Cerrada']
];
const risks = [['','Todos los riesgos'], ['low','Bajo'], ['medium','Medio'], ['high','Alto'], ['very_high','Muy alto']];
const cities = [['','Todas las ciudades'], ['Barcelona','Barcelona'], ['Madrid','Madrid'], ['Valencia','Valencia'], ['Málaga','Málaga']];
const assetTypes = [['','Todos los activos'], ['Residencial urbano','Residencial urbano'], ['Logístico','Logístico'], ['Retail urbano','Retail urbano'], ['Coliving','Coliving']];
const strategies = [['','Todas las estrategias'], ['Rehabilitación energética','Rehabilitación energética'], ['Reposicionamiento','Reposicionamiento'], ['Renta estabilizada','Renta estabilizada'], ['Desarrollo ligero','Desarrollo ligero']];
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
    <label className="grid gap-2 text-sm font-bold text-textLight" htmlFor={name}>
      <span>{label}</span>
      <select id={name} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 border border-border bg-carbon px-3 py-2 text-textLight focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

export function OpportunitiesCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    setPageMetadata('Catálogo público de oportunidades | MILLENNIALS CONSTRUYEN | CAPITAL', 'Oportunidades inmobiliarias demo de MILLENNIALS CONSTRUYEN | CAPITAL con filtros, métricas públicas y objetivos no garantizados.');
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
    <div className="min-h-screen bg-carbon text-textLight">
      <main id="contenido" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav aria-label="breadcrumb" className="text-sm text-muted"><Link className="hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover" to="/">Inicio</Link> <span aria-hidden="true">/</span> <span>Oportunidades</span></nav>
        <section className="grid gap-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-mineral">Catálogo público</p>
            <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.045em] sm:text-7xl">Catálogo público de oportunidades inmobiliarias demo.</h1>
          </div>
          <div className="space-y-4 text-muted">
            <p className="text-lg leading-8">Consulta oportunidades públicas servidas desde PostgreSQL. La información es ilustrativa, no incluye documentos privados ni permite invertir.</p>
            <p className="border border-bronze/50 bg-bronze/10 p-4 text-sm leading-6 text-textLight">Los objetivos no están garantizados y no constituyen una oferta de inversión. El riesgo mostrado es una clasificación interna demo, no una valoración regulatoria oficial.</p>
          </div>
        </section>

        <section aria-label="Filtros del catálogo" className="grid gap-4 border border-border bg-petroleum p-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SelectField label="Estado" name="status" value={params.status ?? ''} options={statuses} onChange={(value) => updateParam('status', value)} />
          <SelectField label="Ciudad" name="city" value={params.city ?? ''} options={cities} onChange={(value) => updateParam('city', value)} />
          <SelectField label="Tipo de activo" name="assetType" value={params.assetType ?? ''} options={assetTypes} onChange={(value) => updateParam('assetType', value)} />
          <SelectField label="Estrategia" name="strategy" value={params.strategy ?? ''} options={strategies} onChange={(value) => updateParam('strategy', value)} />
          <SelectField label="Riesgo" name="riskLevel" value={params.riskLevel ?? ''} options={risks} onChange={(value) => updateParam('riskLevel', value)} />
          <SelectField label="Ordenar" name="sort" value={params.sort ?? 'publishedAt'} options={sorts} onChange={(value) => updateParam('sort', value)} />
          <SelectField label="Dirección" name="direction" value={params.direction ?? 'desc'} options={directions} onChange={(value) => updateParam('direction', value)} />
        </section>

        <section className="mt-8" aria-live="polite">
          {query.isLoading ? <div className="border border-border bg-petroleum p-8" role="status">Cargando catálogo público…</div> : null}
          {query.isError ? <div className="border border-warning bg-petroleum p-8" role="alert">No hemos podido cargar el catálogo. No mostramos oportunidades falsas si la API no responde.</div> : null}
          {query.data && query.data.data.length === 0 ? <div className="border border-border bg-petroleum p-8">No hay oportunidades públicas para estos filtros.</div> : null}
          {query.data && query.data.data.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"><span>{query.data.pagination.total} oportunidades públicas</span><span>{query.isPlaceholderData ? 'Actualizando resultados…' : query.data.meta.disclaimer}</span></div>
              <div className="grid gap-5">{query.data.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}</div>
              <div className="mt-8 flex items-center justify-between gap-4">
                <button type="button" disabled={currentOffset === 0} onClick={() => page(-pageSize)} className="border border-border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Anterior</button>
                <span className="text-sm text-muted">Página {Math.floor(currentOffset / pageSize) + 1}</span>
                <button type="button" disabled={!query.data.pagination.hasMore} onClick={() => page(pageSize)} className="border border-border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Siguiente</button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
