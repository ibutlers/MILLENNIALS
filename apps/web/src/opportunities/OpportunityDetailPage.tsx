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

  const backHref = `/oportunidades${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  useEffect(() => {
    if (query.data?.data) {
      setPageMetadata(`${query.data.data.title} | Realstate`, `${query.data.data.shortDescription} Objetivos no garantizados.`);
    }
  }, [query.data]);

  if (query.isLoading) {
    return <main className="min-h-screen bg-carbon px-4 py-12 text-textLight" role="status">Cargando ficha pública…</main>;
  }

  if (query.isError) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-16 text-textLight">
        <div className="mx-auto max-w-3xl">
          <p className="border border-warning px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-warning">404</p>
          <h1 className="mt-6 font-serif text-5xl tracking-[-0.04em]">Oportunidad no encontrada.</h1>
          <p className="mt-4 leading-8 text-muted">La oportunidad solicitada no está publicada, no existe o no está disponible en el catálogo público.</p>
          <Link to="/oportunidades" className="mt-8 inline-flex bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Volver al catálogo</Link>
        </div>
      </main>
    );
  }

  const detailResponse = query.data;
  if (!detailResponse) {
    return <main className="min-h-screen bg-carbon px-4 py-12 text-textLight" role="status">Cargando ficha pública…</main>;
  }

  const opportunity = detailResponse.data;
  const mainImage = opportunity.media[0] ?? opportunity.primaryImage;
  const location = [opportunity.city, opportunity.district, opportunity.countryCode].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-ivory text-textDark">
      <main id="contenido">
        <section className="bg-carbon text-textLight">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <nav aria-label="breadcrumb" className="text-sm text-muted">
              <Link to="/" className="hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Inicio</Link> <span aria-hidden="true">/</span>{' '}
              <Link to={backHref} className="hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Oportunidades</Link> <span aria-hidden="true">/</span>{' '}
              <span>{opportunity.title}</span>
            </nav>
            <div className="grid gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2"><StatusBadge status={opportunity.status} /><RiskBadge risk={opportunity.riskLevel} /></div>
                <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.045em] sm:text-7xl">{opportunity.title}</h1>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-muted">{location}</p>
              </div>
              <div className="space-y-4 text-muted">
                <p className="text-lg leading-8">{opportunity.shortDescription}</p>
                <p className="border border-bronze/50 bg-bronze/10 p-4 text-sm leading-6 text-textLight">{detailResponse.meta.disclaimer}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {mainImage ? <img src={mainImage.url} alt={mainImage.altText} width="1280" height="720" fetchPriority="high" className="max-h-[620px] w-full border border-carbon/10 object-cover" /> : <div role="img" aria-label="Imagen no publicada" className="h-80 border border-carbon/10 bg-petroleum" />}
          <div className="mt-8 grid gap-8 lg:grid-cols-[0.72fr_0.28fr]">
            <article className="space-y-10">
              <section>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-textDark/75">Resumen</p>
                <h2 className="mt-3 font-serif text-4xl tracking-[-0.035em]">Descripción pública</h2>
                <p className="mt-4 whitespace-pre-line text-lg leading-9 text-textDark/74">{opportunity.description}</p>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Highlights</h2>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">{opportunity.highlights.map((item) => <div key={`${item.label}-${item.position}`} className="border border-carbon/10 bg-white/45 p-4"><dt className="text-sm font-black uppercase tracking-[0.16em] text-textDark/75">{item.label}</dt><dd className="mt-2 leading-7">{item.value}</dd></div>)}</dl>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Riesgos</h2>
                <div className="mt-5 grid gap-3">{opportunity.risks.map((risk) => <article key={`${risk.title}-${risk.position}`} className="border border-bronze/30 bg-bronze/10 p-4"><h3 className="font-bold">{risk.title}</h3><p className="mt-2 leading-7 text-textDark/72">{risk.description}</p></article>)}</div>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Hitos</h2>
                <ol className="mt-5 grid gap-3">{opportunity.milestones.map((milestone) => <li key={`${milestone.title}-${milestone.position}`} className="border-l-4 border-mineral bg-white/45 p-4"><h3 className="font-bold">{milestone.title}</h3><p className="mt-1 text-sm text-textDark/75">Planificado: {formatDate(milestone.plannedDate)}{milestone.completedAt ? ` · completado ${formatDate(milestone.completedAt)}` : ''}</p><p className="mt-2 leading-7 text-textDark/72">{milestone.description}</p></li>)}</ol>
              </section>

              <section>
                <h2 className="font-serif text-4xl tracking-[-0.035em]">Media disponible</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">{opportunity.media.map((media) => <img key={`${media.url}-${media.position}`} src={media.url} alt={media.altText} width="720" height="480" loading="lazy" className="h-64 w-full border border-carbon/10 object-cover" />)}</div>
              </section>
            </article>

            <aside className="h-fit border border-carbon/10 bg-white/55 p-4 shadow-xl shadow-carbon/5 lg:sticky lg:top-24">
              <h2 className="font-serif text-3xl tracking-[-0.035em]">Métricas públicas</h2>
              <dl className="mt-5 grid gap-2">
                <Metric label="Capital objetivo" value={opportunity.targetAmount?.formatted ?? 'No publicado'} emphasis />
                <Metric label="Capital comprometido" value={opportunity.committedAmount?.formatted ?? 'No publicado'} />
                <Metric label="Ticket mínimo" value={opportunity.minimumInvestment?.formatted ?? 'No publicado'} />
                <Metric label="Plazo" value={`${opportunity.estimatedTermMonths} meses`} />
                <Metric label={returnTypeLabel(opportunity.targetReturnType)} value={opportunity.targetReturn.formatted ?? 'No publicado'} emphasis />
                <Metric label="Riesgo" value={`Riesgo ${riskLabel(opportunity.riskLevel)} · no regulatorio`} />
                <Metric label="Cierre" value={formatDate(opportunity.closingDate)} />
                <Metric label="Estado" value={statusLabel(opportunity.status)} />
              </dl>
              <div className="mt-5"><FundingProgress value={opportunity.fundingProgress} /></div>
              <section className="mt-6 border-t border-carbon/10 pt-6">
                <h2 className="font-serif text-3xl tracking-[-0.035em]">Próximos pasos</h2>
                <p className="mt-3 text-sm leading-6 text-textDark/70">Solicita información o acceso futuro para recibir documentación cuando la zona privada esté disponible. No hay inversión ni formulario transaccional en este hito.</p>
                <div className="mt-5 grid gap-3">
                  <Link to="/acceso" onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['opportunities', 'prefetch'], queryFn: ({ signal }) => fetch('/api/v1/opportunities?limit=3', { signal }).then((r) => r.json()) })} className="bg-mineral px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Solicitar información</Link>
                  <Link to="/acceso" className="border border-textDark/20 px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] transition hover:border-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Solicitar acceso</Link>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
