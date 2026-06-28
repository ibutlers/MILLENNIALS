import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import { fetchOpportunityDetail, formatMoneyFromCents, getInvestmentBreakdown, type OpportunityDetail } from './api';
import { FundingProgress, StatusBadge } from './components';

function isProvisionalMedia(media: OpportunityDetail['media'][number] | OpportunityDetail['primaryImage'] | null | undefined) {
  return !media || /provisional/i.test(media.altText);
}

function DetailCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[1.35rem] border border-frost bg-white p-5 shadow-[0_18px_55px_rgba(5,5,5,0.035)] sm:p-7">
      {children}
    </section>
  );
}

function DataRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-frost/75 py-3 last:border-b-0">
      <dt className="max-w-[46%] text-xs font-black uppercase tracking-[0.16em] text-charcoal/70">{label}</dt>
      <dd className={`text-right leading-6 text-ink ${emphasis ? 'font-black' : 'font-bold'}`}>{value}</dd>
    </div>
  );
}

function isInStudy(status: OpportunityDetail['status']) {
  return status === 'in_study' || status === 'coming_soon';
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
  const location = [opportunity.city, opportunity.district].filter(Boolean).join(' · ');
  const showFinancials = (opportunity.projectTotalAmount?.cents ?? 0) > 1;
  const showProgress = showFinancials;
  const investment = getInvestmentBreakdown(opportunity);
  const mediaItems = opportunity.media.filter((media) => media.url !== mainImage?.url);
  const publicHighlights = opportunity.highlights.filter((item) => !/^estado$/i.test(item.label));
  const sideMetrics = showFinancials
    ? [
        { label: 'Inversión', value: investment.required, emphasis: true },
        { label: 'Retorno estimado', value: opportunity.publicReturnDisplay },
        { label: 'Plazo estimado', value: `${opportunity.estimatedTermMonths} meses` },
        { label: 'Ticket mínimo', value: opportunity.minimumInvestment ? formatMoneyFromCents(opportunity.minimumInvestment.cents, opportunity.minimumInvestment.currency) : '—' },
        { label: 'CAPEX total', value: investment.total },
        { label: 'Financiación bancaria', value: investment.bankFinanced }
      ]
    : [
        { label: 'Tipo de activo', value: opportunity.assetType },
        { label: 'Estrategia', value: opportunity.strategy }
      ];

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
            <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)] lg:items-end lg:py-12">
              <div>
                <h1 className="font-serif text-5xl leading-[0.98] tracking-[-0.055em] sm:text-7xl">{opportunity.title}</h1>
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.66fr)_minmax(320px,0.34fr)] lg:items-start">
            <article className="space-y-6">
              <DetailCard>
                <div className="flex flex-col gap-4 border-b border-frost pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-electric">Proyecto</p>
                    <h2 className="mt-2 font-serif text-3xl leading-tight tracking-[-0.035em] text-ink sm:text-4xl">Información</h2>
                  </div>
                  <div className="rounded-2xl border border-electric/25 bg-electric/5 px-4 py-3 text-left sm:text-right">
                    <p className="mb-2 text-[0.64rem] font-black uppercase tracking-[0.18em] text-electric">Estado del proyecto</p>
                    <StatusBadge status={opportunity.status} />
                  </div>
                </div>
                <p className="mt-5 whitespace-pre-line text-lg leading-9 text-charcoal/80">{opportunity.description}</p>
                <dl className="mt-7 grid gap-x-8 gap-y-5 border-t border-frost pt-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-black uppercase tracking-[0.16em] text-charcoal/70">Tipo de activo</dt>
                    <dd className="mt-2 leading-7 text-ink">{opportunity.assetType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-black uppercase tracking-[0.16em] text-charcoal/70">Estrategia</dt>
                    <dd className="mt-2 leading-7 text-ink">{opportunity.strategy}</dd>
                  </div>
                  {publicHighlights.map((item) => (
                    <div key={`${item.label}-${item.position}`}>
                      <dt className="text-xs font-black uppercase tracking-[0.16em] text-charcoal/70">{item.label}</dt>
                      <dd className="mt-2 leading-7 text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </DetailCard>

              {mediaItems.length ? (
                <DetailCard>
                  <h2 className="font-serif text-3xl leading-tight tracking-[-0.035em] text-ink sm:text-4xl">Imágenes adicionales</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {mediaItems.map((media) => (
                      <div key={`${media.url}-${media.position}`} className="relative overflow-hidden rounded-2xl border border-frost bg-electric/5">
                        <img src={media.url} alt={media.altText} width="720" height="480" loading="lazy" className="h-64 w-full object-cover" />
                        {isProvisionalMedia(media) ? <span className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-white">Imagen provisional</span> : null}
                      </div>
                    ))}
                  </div>
                </DetailCard>
              ) : null}
            </article>

            <aside aria-label="Datos clave" className="h-fit rounded-[1.35rem] border border-frost bg-white p-5 shadow-[0_24px_70px_rgba(5,5,5,0.06)] sm:p-6 lg:sticky lg:top-24">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-electric">Ficha pública</p>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.035em]">Datos clave</h2>
              <dl className="mt-5">
                {sideMetrics.map((metric) => <DataRow key={metric.label} label={metric.label} value={metric.value} emphasis={metric.emphasis} />)}
              </dl>
              {isInStudy(opportunity.status) ? <p className="mt-4 text-xs font-bold leading-5 text-electric">Proyecto en estudio: datos preliminares sujetos a actualización.</p> : null}
              {showProgress ? <div className="mt-6 border-t border-frost pt-5"><FundingProgress value={opportunity.fundingProgress} /></div> : null}
              <div className="mt-6 border-t border-frost pt-5">
                <Link to={`/proyectos/${opportunity.slug}/solicitar-informacion`} onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['opportunities', 'prefetch'], queryFn: ({ signal }) => fetch('/api/v1/opportunities?limit=3', { signal }).then((r) => r.json()) })} className="block rounded-full bg-electric px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Solicitar información</Link>
                <Link to="/acceso#solicitud" className="mt-4 block text-center text-xs font-black uppercase tracking-[0.16em] text-electric transition hover:text-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Solicitar acceso al club</Link>
              </div>
              <p className="mt-5 text-xs leading-5 text-charcoal/65">{detailResponse.meta.disclaimer}</p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
