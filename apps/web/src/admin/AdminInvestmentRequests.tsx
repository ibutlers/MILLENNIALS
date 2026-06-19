import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../api/client';

interface InvestmentRequest {
  public_reference: string;
  status: 'requested' | 'approved_pending_transfer' | 'transfer_reported' | 'confirmed' | 'rejected' | 'cancelled';
  investor_email: string;
  investor_name: string | null;
  opportunity_title: string;
  opportunity_slug: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  currency: string;
  investor_message: string | null;
  admin_notes: string | null;
  transfer_reference: string | null;
  transfer_notes: string | null;
  created_at: string;
  approved_at: string | null;
  transfer_reported_at: string | null;
  confirmed_at: string | null;
}

const STATUS_LABEL: Record<InvestmentRequest['status'], string> = {
  requested: 'Solicitada',
  approved_pending_transfer: 'Aceptada · pendiente transferencia',
  transfer_reported: 'Transferencia reportada',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

function cents(centsValue: number | null | undefined, currency = 'EUR') {
  return ((centsValue ?? 0) / 100).toLocaleString('es-ES', { style: 'currency', currency });
}

export default function AdminInvestmentRequests() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery<{ data: InvestmentRequest[] }>({
    queryKey: ['admin', 'investment-requests'],
    queryFn: () => apiFetch('/api/v1/admin/investment-requests'),
  });

  const actionMutation = useMutation({
    mutationFn: (payload: { reference: string; action: 'approve' | 'reject' | 'confirm'; approvedAmountCents?: number; adminNotes?: string | null; confirmationNotes?: string | null }) =>
      apiFetch(`/api/v1/admin/investment-requests/${payload.reference}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'investment-requests'] }),
  });

  const requests = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7FA88C]">Operaciones</p>
        <h1 className="mt-2 font-serif text-3xl text-[#FBF7F0]">Solicitudes de inversión</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9B7E5F]">
          Flujo operativo: el inversor solicita importe, administración acepta, el inversor reporta transferencia y administración confirma al conciliarla.
        </p>
      </div>

      {isLoading ? <div className="rounded border border-[#1A3E48] bg-[#08191C] p-6 text-[#9B7E5F]">Cargando solicitudes…</div> : null}
      {error ? <div className="rounded border border-red-900 bg-red-950/40 p-6 text-red-100">No se han podido cargar las solicitudes.</div> : null}
      {!isLoading && !error && requests.length === 0 ? <div className="rounded border border-[#1A3E48] bg-[#08191C] p-6 text-[#9B7E5F]">Todavía no hay solicitudes de inversión.</div> : null}

      <div className="grid gap-4">
        {requests.map((request) => {
          const note = notes[request.public_reference] ?? request.admin_notes ?? '';
          return (
            <article key={request.public_reference} className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#0F2A30] px-2 py-1 font-mono text-xs text-[#7FA88C]">{request.public_reference}</span>
                    <span className="rounded border border-[#1A3E48] px-2 py-1 text-xs text-[#FBF7F0]">{STATUS_LABEL[request.status]}</span>
                  </div>
                  <h2 className="mt-3 font-serif text-xl text-[#FBF7F0]">{request.opportunity_title}</h2>
                  <p className="mt-1 text-sm text-[#9B7E5F]">{request.investor_name || request.investor_email} · {request.investor_email}</p>
                  {request.investor_message ? <p className="mt-3 rounded bg-[#0F2A30] p-3 text-sm text-[#FBF7F0]">“{request.investor_message}”</p> : null}
                  {request.transfer_reference ? <p className="mt-2 text-sm text-[#7FA88C]">Referencia transferencia: <span className="font-mono">{request.transfer_reference}</span></p> : null}
                  {request.transfer_notes ? <p className="mt-1 text-sm text-[#9B7E5F]">Notas transferencia: {request.transfer_notes}</p> : null}
                </div>
                <div className="grid gap-2 text-sm lg:min-w-64">
                  <div className="rounded bg-[#0F2A30] p-3"><span className="text-[#9B7E5F]">Solicitado</span><p className="font-serif text-2xl text-[#FBF7F0]">{cents(request.requested_amount_cents, request.currency)}</p></div>
                  <div className="rounded bg-[#0F2A30] p-3"><span className="text-[#9B7E5F]">Aprobado</span><p className="font-serif text-2xl text-[#FBF7F0]">{request.approved_amount_cents ? cents(request.approved_amount_cents, request.currency) : '—'}</p></div>
                </div>
              </div>

              {['requested', 'approved_pending_transfer', 'transfer_reported'].includes(request.status) ? (
                <div className="mt-4 grid gap-3 border-t border-[#1A3E48] pt-4 lg:grid-cols-[1fr_auto]">
                  <textarea
                    value={note}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [request.public_reference]: event.target.value }))}
                    placeholder="Notas internas para aceptación, rechazo o confirmación"
                    rows={2}
                    className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {request.status === 'requested' ? (
                      <button onClick={() => actionMutation.mutate({ reference: request.public_reference, action: 'approve', approvedAmountCents: request.requested_amount_cents, adminNotes: note })} disabled={actionMutation.isPending} className="rounded bg-[#7FA88C] px-4 py-2 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50">Aceptar</button>
                    ) : null}
                    {request.status === 'transfer_reported' ? (
                      <button onClick={() => actionMutation.mutate({ reference: request.public_reference, action: 'confirm', confirmationNotes: note })} disabled={actionMutation.isPending} className="rounded bg-[#7FA88C] px-4 py-2 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50">Confirmar transferencia</button>
                    ) : null}
                    {request.status !== 'transfer_reported' ? (
                      <button onClick={() => { if (confirm('¿Rechazar esta solicitud?')) actionMutation.mutate({ reference: request.public_reference, action: 'reject', adminNotes: note }); }} disabled={actionMutation.isPending} className="rounded border border-[#1A3E48] px-4 py-2 text-sm text-[#9B7E5F] hover:bg-[#0F2A30] disabled:opacity-50">Rechazar</button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
