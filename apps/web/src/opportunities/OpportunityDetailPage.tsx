import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchOpportunityDetail, formatDate, returnTypeLabel, riskLabel, statusLabel } from './api';
import { FundingProgress, Metric, RiskBadge, StatusBadge } from './components';

export function OpportunityDetailPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['opportunity', slug],
    queryFn: ({ signal }) => fetchOpportunityDetail(slug, signal),
    retry: false,
    staleTime: 30_000
  });

  const backHref = `/proyectos${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  useEffect(() => {
    if (query.data?.data) {
      setPageMetadata(`${query.data.data.title} | MILLENNIALS CONSTRUYEN`, `${query.data.data.shortDescription} Información preliminar.`);
    }
  }, [query.data]);

  if (query.isLoading) {
    return <main className="min-h-screen bg-lavender px-4 py-12 text-ink" role="status">Cargando ficha…</main>;
  }

  if (query.isError) {
    return (
      <main className="min-h-screen bg-lavender px-4 py-16 text-ink">
        <div className="mx-auto max-w-3xl">
          <p className="border border-warning/40 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-warning">404</p>
          <h1 className="mt-6 font-serif text-5xl tracking-[-0.04em]">Proyecto no encontrado.</h1>
          <p className="mt-4 leading-8 text-charcoal/80">El proyecto solicitado no está publicado, no existe o no está disponible en el catálogo público.</p>
          <Link to="/proyectos" className="mt-8 inline-flex rounded-lg bg-electric px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Volver a proyectos</Link>
        </div>
      </main>
    );
  }

  const detailResponse = query.data;
  if (!detailResponse) {
    return <main className="min-h-screen bg-lavender px-4 py-12 text-ink" role="status">Cargando ficha…</main>;
  }

  const opportunity = detailResponse.data;
  const mainImage = opportunity.media[0] ?? opportunity.primaryImage;
  const location = [opportunity.city, opportunity.district, opportunity.countryCode].filter(Boolean).join(' · ');
  const showFinancials = (opportunity.targetAmount?.cents ?? 0) > 1;
  const progress = Math.max(0, Math.min(100, opportunity.fundingProgress));
  const showProgress = progress === 100 || (progress > 0 && (opportunity.committedAmount?.cents ?? 0) > 0);

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <main id="contenido">
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <nav aria-label="breadcrumb" className="text-sm text-charcoal/60">
              <Link to="/" className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Inicio</Link> <span aria-hidden="true">/</span>{' '}
              <Link to={backHref} className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Proyectos</Link> <span aria-hidden="true">/</span>{' '}
              <span>{opportunity.title}</span>
            </nav>
            <div className="grid gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={opportunity.status} />{showFinancials ? <RiskBadge risk={opportunity.riskLevel} /> : null}</div>
                <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.045em] sm:text-7xl">{opportunity.title}</h1>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-charcoal/60">{location}</p>
              </div>
              <div className="space-y-4">
                <p className="text-lg leading-8 text-charcoal/80">{opportunity.shortDescription}</p>
                <p className="rounded-lg border border-frost bg-electric/5 p-4 text-sm leading-6 text-charcoal/80">{detailResponse.meta.disclaimer}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="relative">
            {mainImage ? <img src={mainImage.url} alt={mainImage.altText} width="1280" height="720" fetchPriority="high" className="max-h-[620px] w-full rounded-lg border border-frost object-cover" /> : <div role="img" aria-label="Imagen no publicada" className="h-80 rounded-lg border border-frost bg-electric/5" />}
            <span className="absolute bottom-3 right-3 border border-white/30 bg-ink/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white backdrop-blur-sm">Imagen provisional</span>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[0.72fr_0.28fr]">
            <article className="space-y-10">
              <section>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-electric">Resumen</p>
                <h2 className="mt-3 font-serif text-4xl tracking-[-0.035em]">Descripción pública</h2>
                <p className="mt-4 whitespace-pre-line text-lg leading-9 text-charcoal/80">{opportunity.description}</p>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Highlights</h2>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">{opportunity.highlights.map((item) => <div key={`${item.label}-${item.position}`} className="rounded-lg border border-frost bg-white p-4"><dt className="text-sm font-black uppercase tracking-[0.16em] text-charcoal/60">{item.label}</dt><dd className="mt-2 leading-7">{item.value}</dd></div>)}</dl>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Riesgos</h2>
                <div className="mt-5 grid gap-3">{opportunity.risks.map((risk) => <article key={`${risk.title}-${risk.position}`} className="rounded-lg border border-frost bg-white p-4"><h3 className="font-bold">{risk.title}</h3><p className="mt-2 leading-7 text-charcoal/80">{risk.description}</p></article>)}</div>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Hitos</h2>
                <ol className="mt-5 grid gap-3">{opportunity.milestones.map((milestone) => <li key={`${milestone.title}-${milestone.position}`} className="rounded-lg border-l-4 border-electric bg-white p-4"><h3 className="font-bold">{milestone.title}</h3><p className="mt-1 text-sm text-charcoal/60">Planificado: {formatDate(milestone.plannedDate)}{milestone.completedAt ? ` · completado ${formatDate(milestone.completedAt)}` : ''}</p><p className="mt-2 leading-7 text-charcoal/80">{milestone.description}</p></li>)}</ol>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Media disponible</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">{opportunity.media.map((media) => <img key={`${media.url}-${media.position}`} src={media.url} alt={media.altText} width="720" height="480" loading="lazy" className="h-64 w-full rounded-lg border border-frost object-cover" />)}</div>
              </section>
            </article>

            <aside className="h-fit rounded-lg border border-frost bg-white p-4 lg:sticky lg:top-24">
              <h2 className="font-serif text-3xl tracking-[-0.035em]">Métricas públicas</h2>
              {showFinancials ? (
                <dl className="mt-5 grid gap-2">
                  <Metric label="Capital objetivo" value={opportunity.targetAmount?.formatted ?? '—'} emphasis />
                  <Metric label="Capital comprometido" value={opportunity.committedAmount?.formatted ?? '—'} />
                  <Metric label="Ticket mínimo" value={opportunity.minimumInvestment?.formatted ?? '—'} />
                  <Metric label="Plazo" value={`${opportunity.estimatedTermMonths} meses`} />
                  <Metric label={returnTypeLabel(opportunity.targetReturnType)} value={opportunity.targetReturn.formatted ?? '—'} emphasis />
                  <Metric label="Riesgo" value={`Riesgo ${riskLabel(opportunity.riskLevel)} · no regulatorio`} />
                  <Metric label="Cierre" value={formatDate(opportunity.closingDate)} />
                  <Metric label="Estado" value={statusLabel(opportunity.status)} />
                </dl>
              ) : (
                <dl className="mt-5 grid gap-2">
                  <Metric label="Estado" value={statusLabel(opportunity.status)} />
                  <Metric label="Estrategia" value={opportunity.strategy} />
                  <Metric label="Tipo de activo" value={opportunity.assetType} />
                </dl>
              )}
              {showProgress ? <div className="mt-5"><FundingProgress value={opportunity.fundingProgress} /></div> : null}
              <section className="mt-6 border-t border-frost pt-6">
                <h2 className="font-serif text-3xl tracking-[-0.035em]">Próximos pasos</h2>
                <p className="mt-3 text-sm leading-6 text-charcoal/80">Solicita información o acceso futuro para recibir documentación cuando la zona privada esté disponible. No hay inversión ni formulario transaccional en este hito.</p>
                <div className="mt-5 grid gap-3">
                  <Link to={`/proyectos/${opportunity.slug}/solicitar-informacion`} onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['opportunities', 'prefetch'], queryFn: ({ signal }) => fetch('/api/v1/opportunities?limit=3', { signal }).then((r) => r.json()) })} className="rounded-lg bg-electric px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Solicitar información</Link>
                  <Link to="/coinvierte" className="rounded-lg border border-frost px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Coinvierte con nosotros</Link>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
