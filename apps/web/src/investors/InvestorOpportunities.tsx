import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchPublicOpportunities, type PublicOpportunity, statusLabel } from '../opportunities/api';
import { setPageMetadata } from '../metadata';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'success'; data: PublicOpportunity[] };

interface InvestmentRequest {
  public_reference: string;
  status: string;
  opportunity_slug: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  transfer_reference: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Solicitada · pendiente de revisión',
  approved_pending_transfer: 'Aceptada · pendiente transferencia',
  transfer_reported: 'Transferencia reportada',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

function eurToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function cents(centsValue: number | null | undefined, currency = 'EUR') {
  return ((centsValue ?? 0) / 100).toLocaleString('es-ES', { style: 'currency', currency });
}

function isOpen(status: PublicOpportunity['status']) {
  return status === 'open' || status === 'funding';
}

export function InvestorOpportunities() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [requests, setRequests] = useState<InvestmentRequest[]>([]);
  const [form, setForm] = useState<Record<string, { amount: string; message: string }>>({});
  const [transfer, setTransfer] = useState<Record<string, { reference: string; notes: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    setPageMetadata('Oportunidades | MILLENNIALS CONSTRUYEN', 'Catálogo de oportunidades de inversión disponibles en MILLENNIALS CONSTRUYEN.');
  }, []);

  function reloadRequests(signal?: AbortSignal) {
    return fetch('/api/investor/investment-requests', { signal, headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((body) => setRequests(Array.isArray(body.data) ? body.data : []));
  }

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    Promise.all([
      fetchPublicOpportunities(controller.signal, { limit: 20 }),
      reloadRequests(controller.signal),
    ])
      .then(([response]) => {
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

  async function submitRequest(opportunity: PublicOpportunity) {
    const current = form[opportunity.slug] ?? { amount: '', message: '' };
    const amountCents = eurToCents(current.amount);
    setSubmitting(opportunity.slug);
    setNotice(null);
    try {
      const response = await fetch(`/api/investor/projects/${encodeURIComponent(opportunity.slug)}/investment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ amountCents, currency: opportunity.currency, message: current.message || null }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'No se ha podido enviar la solicitud.');
      }
      setNotice('Solicitud enviada. La revisaremos y, si encaja, la aceptaremos para que puedas transferir.');
      setForm((prev) => ({ ...prev, [opportunity.slug]: { amount: '', message: '' } }));
      await reloadRequests();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  async function reportTransfer(request: InvestmentRequest) {
    const current = transfer[request.public_reference] ?? { reference: '', notes: '' };
    setSubmitting(request.public_reference);
    setNotice(null);
    try {
      const response = await fetch(`/api/investor/investment-requests/${encodeURIComponent(request.public_reference)}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ transferReference: current.reference, transferNotes: current.notes || null }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'No se ha podido reportar la transferencia.');
      }
      setNotice('Transferencia reportada. La confirmaremos cuando esté conciliada.');
      setTransfer((prev) => ({ ...prev, [request.public_reference]: { reference: '', notes: '' } }));
      await reloadRequests();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">Oportunidades</p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">Oportunidades disponibles</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
        Puedes solicitar inversión en los proyectos abiertos. La solicitud llega al equipo, se acepta manualmente, después realizas transferencia y finalmente confirmamos la operación.
      </p>

      {notice ? <div className="mt-6 border border-mineral/40 bg-petroleum p-4 text-sm leading-6 text-textLight" role="status">{notice}</div> : null}

      {requests.length > 0 ? (
        <section className="mt-8 border border-border bg-petroleum p-5">
          <h2 className="font-serif text-2xl text-textLight">Tus solicitudes</h2>
          <div className="mt-4 grid gap-3">
            {requests.map((request) => (
              <div key={request.public_reference} className="rounded border border-border bg-carbon p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-mono text-xs text-mineral">{request.public_reference}</p>
                    <p className="mt-1 text-sm text-textLight">{STATUS_LABEL[request.status] ?? request.status}</p>
                    <p className="mt-1 text-sm text-muted">Solicitado: {cents(request.requested_amount_cents)}{request.approved_amount_cents ? ` · Aprobado: ${cents(request.approved_amount_cents)}` : ''}</p>
                  </div>
                  {request.status === 'approved_pending_transfer' ? (
                    <div className="grid gap-2 lg:min-w-[420px] lg:grid-cols-[1fr_1fr_auto]">
                      <input value={transfer[request.public_reference]?.reference ?? ''} onChange={(e) => setTransfer((prev) => ({ ...prev, [request.public_reference]: { ...(prev[request.public_reference] ?? { reference: '', notes: '' }), reference: e.target.value } }))} placeholder="Referencia transferencia" className="rounded border border-border bg-petroleum px-3 py-2 text-sm text-textLight placeholder:text-muted focus:border-mineral focus:outline-none" />
                      <input value={transfer[request.public_reference]?.notes ?? ''} onChange={(e) => setTransfer((prev) => ({ ...prev, [request.public_reference]: { ...(prev[request.public_reference] ?? { reference: '', notes: '' }), notes: e.target.value } }))} placeholder="Notas" className="rounded border border-border bg-petroleum px-3 py-2 text-sm text-textLight placeholder:text-muted focus:border-mineral focus:outline-none" />
                      <button onClick={() => reportTransfer(request)} disabled={submitting === request.public_reference || !(transfer[request.public_reference]?.reference ?? '').trim()} className="rounded bg-mineral px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-carbon hover:bg-mineralHover disabled:opacity-50">Reportar</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {state.status === 'loading' ? <div className="mt-8 border border-border bg-petroleum p-6 text-muted" role="status">Cargando oportunidades…</div> : null}
      {state.status === 'error' ? <div className="mt-8 border border-danger bg-danger/10 p-6 text-textLight" role="alert">No hemos podido cargar las oportunidades en este momento.</div> : null}
      {state.status === 'empty' ? <div className="mt-8 border border-border bg-petroleum p-6 text-muted">No hay oportunidades disponibles en este momento.</div> : null}

      {state.status === 'success' ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {state.data.map((opportunity) => {
            const open = isOpen(opportunity.status);
            const current = form[opportunity.slug] ?? { amount: '', message: '' };
            const existing = requests.find((request) => request.opportunity_slug === opportunity.slug && ['requested', 'approved_pending_transfer', 'transfer_reported'].includes(request.status));
            return (
              <article key={opportunity.slug} className="overflow-hidden border border-border bg-carbon transition hover:border-mineral/50">
                {opportunity.primaryImage ? <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="600" loading="lazy" className="h-44 w-full object-cover opacity-80" /> : <div className="h-44 w-full bg-gradient-to-br from-petroleum to-carbon" role="img" aria-label="Imagen pendiente de publicar" />}
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted">{statusLabel(opportunity.status)}</span>
                    {open ? <span className="border border-mineral/50 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-mineral">Abierta a solicitudes</span> : null}
                  </div>
                  <h3 className="mt-4 font-serif text-2xl leading-tight tracking-[-0.02em]">{opportunity.title}</h3>
                  <p className="mt-2 text-sm text-muted">{[opportunity.city, opportunity.district].filter(Boolean).join(' · ')}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{opportunity.shortDescription}</p>
                  <div className="mt-4 grid gap-2 text-sm text-muted"><span>Ticket mínimo: {opportunity.minimumInvestment?.formatted ?? '—'}</span><span>Comprometido: {opportunity.committedAmount?.formatted ?? '—'}</span></div>
                  {open ? (
                    <div className="mt-4 space-y-2 rounded border border-border bg-petroleum p-3">
                      {existing ? <p className="text-sm text-mineral">Ya tienes una solicitud activa para este proyecto.</p> : (
                        <>
                          <input value={current.amount} onChange={(e) => setForm((prev) => ({ ...prev, [opportunity.slug]: { ...current, amount: e.target.value } }))} inputMode="decimal" placeholder="Importe a solicitar (€)" className="w-full rounded border border-border bg-carbon px-3 py-2 text-sm text-textLight placeholder:text-muted focus:border-mineral focus:outline-none" />
                          <textarea value={current.message} onChange={(e) => setForm((prev) => ({ ...prev, [opportunity.slug]: { ...current, message: e.target.value } }))} rows={2} placeholder="Mensaje opcional para el equipo" className="w-full rounded border border-border bg-carbon px-3 py-2 text-sm text-textLight placeholder:text-muted focus:border-mineral focus:outline-none" />
                          <button onClick={() => submitRequest(opportunity)} disabled={submitting === opportunity.slug || eurToCents(current.amount) <= 0} className="w-full rounded bg-mineral px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-carbon hover:bg-mineralHover disabled:opacity-50">Solicitar inversión</button>
                        </>
                      )}
                    </div>
                  ) : <p className="mt-4 rounded border border-border bg-petroleum p-3 text-sm text-muted">Este proyecto no está abierto a nuevas solicitudes de inversión.</p>}
                  <Link to={`/proyectos/${opportunity.slug}`} className="mt-4 inline-flex border border-border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Ver detalle público</Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
