import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchOpportunityDetail, formatDate, getInvestmentBreakdown, statusLabel, type OpportunityDetail } from './api';
import { FundingProgress, Metric, StatusBadge } from './components';

function isProvisionalMedia(media: OpportunityDetail['media'][number] | OpportunityDetail['primaryImage'] | null | undefined) {
  return !media || /provisional/i.test(media.altText);
}

function DetailSection({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-frost bg-white p-5 shadow-[0_18px_55px_rgba(5,5,5,0.035)] sm:p-7">
      {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.22em] text-electric">{eyebrow}</p> : null}
      <h2 className="mt-2 font-serif text-3xl leading-tight tracking-[-0.035em] text-ink sm:text-4xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyPublicBlock({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-frost bg-lavender/45 p-4 text-sm leading-6 text-charcoal/75">{children}</p>;
}

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
        <div className="mx-auto max-w-3xl rounded-2xl border border-warning/40 bg-white p-8 shadow-[0_18px_55px_rgba(5,5,5,0.04)]">
          <p className="inline-flex rounded-full border border-warning/40 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-warning">404</p>
          <h1 className="mt-6 font-serif text-5xl tracking-[-0.04em]">Proyecto no encontrado.</h1>
          <p className="mt-4 leading-8 text-charcoal/80">El proyecto solicitado no está publicado, no existe o no está disponible en el catálogo público.</p>
          <Link to="/proyectos" className="mt-8 inline-flex rounded-full bg-electric px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Volver a proyectos</Link>
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
  const mainImageIsProvisional = isProvisionalMedia(mainImage);
  const location = [opportunity.city, opportunity.district, opportunity.countryCode].filter(Boolean).join(' · ');
  const showFinancials = (opportunity.projectTotalAmount?.cents ?? 0) > 1;
  const showProgress = showFinancials;
  const investment = getInvestmentBreakdown(opportunity);
  const mediaItems = opportunity.media.filter((media) => media.url !== mainImage?.url);

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <main id="contenido">
        <section className="border-b border-frost/70 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <nav aria-label="breadcrumb" className="text-sm text-charcoal/70">
              <Link to="/" className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Inicio</Link> <span aria-hidden="true">/</span>{' '}
              <Link to={backHref} className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Proyectos</Link> <span aria-hidden="true">/</span>{' '}
              <span>{opportunity.title}</span>
            </nav>
            <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,0.48fr)_minmax(0,0.52fr)] lg:items-end lg:py-12">
              <div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={opportunity.status} /></div>
                <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.055em] sm:text-7xl">{opportunity.title}</h1>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-charcoal/70">{location}</p>
                <p className="mt-5 max-w-xl text-lg leading-8 text-charcoal/80">{opportunity.shortDescription}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to={`/proyectos/${opportunity.slug}/solicitar-informacion`} onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['opportunities', 'prefetch'], queryFn: ({ signal }) => fetch('/api/v1/opportunities?limit=3', { signal }).then((r) => r.json()) })} className="rounded-full bg-electric px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_32px_rgba(45,80,236,0.22)] transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Solicitar información</Link>
                  <Link to={backHref} className="rounded-full border border-frost px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Volver al catálogo</Link>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[1.6rem] border border-frost bg-electric/5 shadow-[0_28px_90px_rgba(5,5,5,0.08)]">
                {mainImage ? (
                  <img src={mainImage.url} alt={mainImage.altText} width="1280" height="720" fetchPriority="high" className="max-h-[560px] min-h-[320px] w-full object-cover" />
                ) : (
                  <div role="img" aria-label="Imagen no publicada" className="h-80 bg-electric/5" />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" aria-hidden="true" />
                {mainImageIsProvisional ? <span className="absolute bottom-4 right-4 rounded-full border border-white/30 bg-ink/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">Imagen provisional</span> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.68fr)_minmax(300px,0.32fr)] lg:items-start">
            <article className="space-y-8">
              <DetailSection eyebrow="Resumen" title="Descripción pública">
                <p className="whitespace-pre-line text-lg leading-9 text-charcoal/80">{opportunity.description}</p>
              </DetailSection>

              <DetailSection title="Highlights">
                {opportunity.highlights.length ? (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {opportunity.highlights.map((item) => (
                      <div key={`${item.label}-${item.position}`} className="rounded-xl border border-frost bg-lavender/35 p-4">
                        <dt className="text-xs font-black uppercase tracking-[0.16em] text-charcoal/70">{item.label}</dt>
                        <dd className="mt-2 leading-7 text-ink">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <EmptyPublicBlock>No hay highlights públicos publicados para esta ficha.</EmptyPublicBlock>}
              </DetailSection>

              <DetailSection title="Riesgos">
                {opportunity.risks.length ? (
                  <div className="grid gap-3">
                    {opportunity.risks.map((risk) => (
                      <article key={`${risk.title}-${risk.position}`} className="rounded-xl border border-frost bg-lavender/35 p-4">
                        <h3 className="font-bold text-ink">{risk.title}</h3>
                        <p className="mt-2 leading-7 text-charcoal/80">{risk.description}</p>
                      </article>
                    ))}
                  </div>
                ) : <EmptyPublicBlock>No hay riesgos públicos publicados para esta ficha.</EmptyPublicBlock>}
              </DetailSection>

              <DetailSection title="Hitos">
                {opportunity.milestones.length ? (
                  <ol className="grid gap-3">
                    {opportunity.milestones.map((milestone) => (
                      <li key={`${milestone.title}-${milestone.position}`} className="grid gap-3 rounded-xl border border-frost bg-lavender/35 p-4 sm:grid-cols-[auto_1fr]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-electric text-sm font-black text-white">{milestone.position + 1}</span>
                        <div>
                          <h3 className="font-bold text-ink">{milestone.title}</h3>
                          <p className="mt-1 text-sm text-charcoal/70">Planificado: {formatDate(milestone.plannedDate)}{milestone.completedAt ? ` · completado ${formatDate(milestone.completedAt)}` : ''}</p>
                          <p className="mt-2 leading-7 text-charcoal/80">{milestone.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <EmptyPublicBlock>No hay hitos públicos publicados para esta ficha.</EmptyPublicBlock>}
              </DetailSection>

              <DetailSection title="Media disponible">
                {mediaItems.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mediaItems.map((media) => (
                      <div key={`${media.url}-${media.position}`} className="relative overflow-hidden rounded-2xl border border-frost bg-electric/5">
                        <img src={media.url} alt={media.altText} width="720" height="480" loading="lazy" className="h-64 w-full object-cover" />
                        {isProvisionalMedia(media) ? <span className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white">Imagen provisional</span> : null}
                      </div>
                    ))}
                  </div>
                ) : <EmptyPublicBlock>No hay imágenes adicionales publicadas.</EmptyPublicBlock>}
              </DetailSection>
            </article>

            <aside className="h-fit rounded-[1.4rem] border border-frost bg-white p-5 shadow-[0_24px_70px_rgba(5,5,5,0.06)] sm:p-6 lg:sticky lg:top-24">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-electric">Ficha pública</p>
                <h2 className="mt-3 font-serif text-3xl tracking-[-0.035em]">Métricas públicas</h2>
                <p className="mt-3 text-sm leading-6 text-charcoal/75">Información orientativa publicada para revisar estado, tesis y próximos pasos.</p>
              </div>
              {showFinancials ? (
                <dl className="mt-6 grid gap-2">
                  <Metric label="Inversión" value={investment.contributed} />
                  <Metric label="Financiación bancaria" value={investment.bankFinanced} />
                  <Metric label="CAPEX total" value={investment.total} />
                  <Metric label="Ticket mínimo" value={opportunity.minimumInvestment?.formatted ?? '—'} />
                  <Metric label="Plazo" value={`${opportunity.estimatedTermMonths} meses`} />
                  <Metric label="Retorno estimado" value={opportunity.publicReturnDisplay} />
                  <Metric label="Cierre" value={formatDate(opportunity.closingDate)} />
                  <Metric label="Estado" value={statusLabel(opportunity.status)} />
                </dl>
              ) : (
                <dl className="mt-6 grid gap-2">
                  <Metric label="Estado" value={statusLabel(opportunity.status)} />
                  <Metric label="Estrategia" value={opportunity.strategy} />
                  <Metric label="Tipo de activo" value={opportunity.assetType} />
                </dl>
              )}
              {showProgress ? <div className="mt-6 rounded-2xl border border-frost bg-lavender/35 p-4"><FundingProgress value={opportunity.fundingProgress} /></div> : null}
              <section className="mt-6 border-t border-frost pt-6">
                <h2 className="font-serif text-3xl tracking-[-0.035em]">Próximos pasos</h2>
                <p className="mt-3 text-sm leading-6 text-charcoal/80">Solicita información o acceso futuro para recibir documentación cuando la zona privada esté disponible. No hay inversión ni formulario transaccional en este hito.</p>
                <div className="mt-5 grid gap-3">
                  <Link to={`/proyectos/${opportunity.slug}/solicitar-informacion`} onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['opportunities', 'prefetch'], queryFn: ({ signal }) => fetch('/api/v1/opportunities?limit=3', { signal }).then((r) => r.json()) })} className="rounded-full bg-electric px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Abrir formulario</Link>
                  <Link to="/coinvierte" className="rounded-full border border-frost px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Coinvierte con nosotros</Link>
                </div>
              </section>
              <p className="mt-6 rounded-xl border border-frost bg-lavender/35 p-4 text-xs leading-5 text-charcoal/75">{detailResponse.meta.disclaimer}</p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
