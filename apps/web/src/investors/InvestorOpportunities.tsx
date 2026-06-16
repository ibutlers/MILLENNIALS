import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPublicOpportunities, type PublicOpportunity, statusLabel } from '../opportunities/api';
import { setPageMetadata } from '../metadata';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'success'; data: PublicOpportunity[] };

export function InvestorOpportunities() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    setPageMetadata('Oportunidades | MILLENNIALS CONSTRUYEN', 'Catálogo de oportunidades de inversión disponibles en MILLENNIALS CONSTRUYEN.');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    fetchPublicOpportunities(controller.signal, { limit: 20 })
      .then((response) => {
        if (response.data.length === 0) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'success', data: response.data });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Oportunidades
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Oportunidades disponibles
      </h1>
      <p className="mt-4 text-lg leading-8 text-muted">
        Consulta las oportunidades públicas de MILLENNIALS CONSTRUYEN. Todavía no hay funcionalidad de inversión — podrás invertir cuando se habiliten los flujos de inversión en próximos hitos.
      </p>

      {/* ── Honest notice ── */}
      <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        Todavía no hay funcionalidad de inversión. Las oportunidades mostradas son informativas. No es posible invertir, reservar ni comprometer capital en este hito.
      </div>

      {/* ── Loading ── */}
      {state.status === 'loading' ? (
        <div className="mt-8 border border-border bg-petroleum p-6 text-muted" role="status">
          Cargando oportunidades…
        </div>
      ) : null}

      {/* ── Error ── */}
      {state.status === 'error' ? (
        <div className="mt-8 border border-danger bg-danger/10 p-6 text-textLight" role="alert">
          No hemos podido cargar las oportunidades en este momento.
        </div>
      ) : null}

      {/* ── Empty ── */}
      {state.status === 'empty' ? (
        <div className="mt-8 border border-border bg-petroleum p-6 text-muted">
          No hay oportunidades disponibles en este momento.
        </div>
      ) : null}

      {/* ── List ── */}
      {state.status === 'success' ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {state.data.map((opportunity) => (
            <article
              key={opportunity.slug}
              className="overflow-hidden border border-border bg-carbon transition hover:border-mineral/50"
            >
              {opportunity.primaryImage ? (
                <img
                  src={opportunity.primaryImage.url}
                  alt={opportunity.primaryImage.altText}
                  width="900" height="600"
                  loading="lazy"
                  className="h-44 w-full object-cover opacity-80"
                />
              ) : (
                <div className="h-44 w-full bg-gradient-to-br from-petroleum to-carbon" role="img" aria-label="Imagen pendiente de publicar" />
              )}
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-mineral/50 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-mineral">Datos ilustrativos</span>
                  <span className="border border-border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted">{statusLabel(opportunity.status)}</span>
                </div>
                <h3 className="mt-4 font-serif text-2xl leading-tight tracking-[-0.02em]">{opportunity.title}</h3>
                <p className="mt-2 text-sm text-muted">{[opportunity.city, opportunity.district].filter(Boolean).join(' · ')}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{opportunity.shortDescription}</p>
                <Link
                  to={`/proyectos/${opportunity.slug}`}
                  className="mt-4 inline-flex border border-border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
                >
                  Ver detalle público
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
