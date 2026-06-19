import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { setPageMetadata } from '../metadata';
import {
  fetchInvestorJson,
  formatBytes,
  formatMoney,
  investorErrorTitle,
  type InvestorApiError,
  type InvestorDocument,
  type InvestorProject,
} from './api';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: InvestorApiError }
  | { status: 'success'; project: InvestorProject; documents: InvestorDocument[] };

function targetReturn(project: InvestorProject): string {
  if (!project.target_return_bps) return 'No publicada';
  return `${(Number(project.target_return_bps) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function InvestorProjectDetail() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    setPageMetadata('Proyecto privado | MILLENNIALS CONSTRUYEN', 'Detalle privado de proyecto para inversores autorizados.');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ status: 'loading' });
      try {
        const project = await fetchInvestorJson<InvestorProject>(`/api/investor/projects/${encodeURIComponent(slug)}`, controller.signal);
        const documents = await fetchInvestorJson<InvestorDocument[]>(`/api/investor/projects/${encodeURIComponent(slug)}/documents`, controller.signal);
        setState({ status: 'success', project, documents });
        setPageMetadata(`${project.title} | Área inversor`, `Detalle privado del proyecto ${project.title}.`);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', error: error as InvestorApiError });
      }
    }
    void load();
    return () => controller.abort();
  }, [slug]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link to="/inversores/cartera" className="text-sm text-mineral underline-offset-4 hover:underline">← Volver a cartera</Link>

      {state.status === 'loading' ? (
        <section className="mt-8 border border-border bg-petroleum p-8 text-muted" role="status">Cargando proyecto privado…</section>
      ) : null}

      {state.status === 'error' ? (
        <section className="mt-8 border border-danger bg-danger/10 p-8 text-textLight" role="alert">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-danger">{state.error.status || 'red'}</p>
          <h1 className="mt-2 font-serif text-4xl">{investorErrorTitle(state.error)}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">{state.error.message}</p>
          {state.error.kind === 'forbidden' ? <p className="mt-3 text-sm text-muted">Si crees que deberías ver este proyecto, contacta con el equipo para revisar tu permiso activo.</p> : null}
        </section>
      ) : null}

      {state.status === 'success' ? (
        <>
          <header className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">Proyecto autorizado</p>
            <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">{state.project.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">{state.project.description || state.project.short_description || 'Información privada del proyecto.'}</p>
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-border bg-petroleum p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted">Capital asignado</p><p className="mt-2 font-serif text-3xl text-textLight">{formatMoney(state.project.investor_committed_amount_cents, state.project.investor_currency || 'EUR')}</p></div>
            <div className="border border-border bg-petroleum p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted">Estado</p><p className="mt-2 font-serif text-3xl text-textLight">{state.project.status}</p></div>
            <div className="border border-border bg-petroleum p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted">Rentabilidad objetivo</p><p className="mt-2 font-serif text-3xl text-textLight">{targetReturn(state.project)}</p></div>
            <div className="border border-border bg-petroleum p-5"><p className="text-xs uppercase tracking-[0.18em] text-muted">Plazo estimado</p><p className="mt-2 font-serif text-3xl text-textLight">{state.project.estimated_term_months ? `${state.project.estimated_term_months} meses` : '—'}</p></div>
          </section>

          {state.project.investor_notes ? (
            <section className="mt-6 border border-border bg-carbon p-5 text-sm leading-6 text-muted">
              <h2 className="font-serif text-xl text-textLight">Notas del equipo</h2>
              <p className="mt-3">{state.project.investor_notes}</p>
            </section>
          ) : null}

          <section className="mt-8 border border-border bg-carbon p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-mineral">Documentos del proyecto</p>
                <h2 className="mt-2 font-serif text-2xl text-textLight">Acceso documental</h2>
              </div>
              <Link to="/inversores/documentos" className="text-sm text-mineral underline-offset-4 hover:underline">Ver todos</Link>
            </div>
            {state.documents.length === 0 ? (
              <p className="mt-5 rounded border border-border bg-petroleum p-4 text-sm leading-6 text-muted">Todavía no hay documentos publicados para este proyecto.</p>
            ) : (
              <div className="mt-5 grid gap-3">
                {state.documents.map((document) => (
                  <div key={document.id} className="rounded border border-border bg-petroleum p-4">
                    <p className="font-medium text-textLight">{document.title}</p>
                    <p className="mt-1 text-sm text-muted">{document.type} · {document.mime_type ?? 'tipo pendiente'} · {formatBytes(document.byte_size)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
