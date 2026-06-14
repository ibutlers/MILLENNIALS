import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState } from 'react';

interface LeadDetail {
  id: string;
  public_reference: string;
  kind: string;
  status: string;
  opportunity_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  notes?: Array<{ id: string; content: string; author_id: string; created_at: string }>;
}

export default function AdminLeadDetail() {
  const { reference } = useParams<{ reference: string }>();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading, error } = useQuery<{ data: LeadDetail }>({
    queryKey: ['admin', 'leads', reference],
    queryFn: () => apiFetch(`/api/v1/admin/leads/${reference}`),
    enabled: !!reference,
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) => apiFetch(`/api/v1/admin/leads/${reference}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    onSuccess: () => { setNoteText(''); queryClient.invalidateQueries({ queryKey: ['admin', 'leads', reference] }); },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiFetch(`/api/v1/admin/leads/${reference}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { setNewStatus(''); queryClient.invalidateQueries({ queryKey: ['admin', 'leads', reference] }); },
  });

  if (isLoading) return <div className="animate-pulse text-[#9B7E5F]">Cargando lead…</div>;
  if (error || !data) return <div className="text-[#9B7E5F]">Lead no encontrado.</div>;

  const lead = data.data;

  return (
    <div className="space-y-6">
      <Link to="/admin/leads" className="text-sm text-[#7FA88C] hover:underline">← Volver al listado</Link>
      <h2 className="font-serif text-2xl text-[#FBF7F0]">Lead <span className="font-mono text-[#7FA88C]">{lead.public_reference}</span></h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5 space-y-3">
          <h3 className="font-serif text-lg text-[#7FA88C]">Detalles</h3>
          <div>
            <span className="text-sm text-[#9B7E5F]">Referencia:</span>
            <span className="ml-2 text-sm font-mono text-[#FBF7F0]">{lead.public_reference}</span>
          </div>
          <div>
            <span className="text-sm text-[#9B7E5F]">Tipo:</span>
            <span className="ml-2 text-sm text-[#FBF7F0]">{lead.kind}</span>
          </div>
          <div>
            <span className="text-sm text-[#9B7E5F]">Estado:</span>
            <span className="ml-2 text-sm text-[#7FA88C]">{lead.status}</span>
          </div>
          <div>
            <span className="text-sm text-[#9B7E5F]">Creado:</span>
            <span className="ml-2 text-sm text-[#FBF7F0]">{new Date(lead.created_at).toLocaleString('es-ES')}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-1.5 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
              <option value="">Cambiar estado</option>
              <option value="new">Nuevo</option><option value="in_review">En revisión</option><option value="contacted">Contactado</option>
              <option value="qualified">Cualificado</option><option value="disqualified">Descartado</option><option value="converted">Convertido</option>
            </select>
            <button
              onClick={() => newStatus && statusMutation.mutate(newStatus)}
              disabled={!newStatus || statusMutation.isPending}
              className="rounded bg-[#7FA88C] px-3 py-1.5 text-sm text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50"
            >
              {statusMutation.isPending ? '…' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
          <h3 className="font-serif text-lg text-[#7FA88C]">Notas</h3>
          {lead.notes && lead.notes.length > 0 ? (
            <div className="mt-3 space-y-3">
              {lead.notes.map((note) => (
                <div key={note.id} className="rounded bg-[#0F2A30] p-3">
                  <p className="text-sm text-[#FBF7F0]">{note.content}</p>
                  <p className="mt-1 text-xs text-[#5C8D7A]">{new Date(note.created_at).toLocaleString('es-ES')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#5C8D7A]">Sin notas.</p>
          )}
          <div className="mt-4 flex gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Añadir nota operativa…"
              rows={2}
              className="flex-1 rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none"
            />
            <button
              onClick={() => noteText && noteMutation.mutate(noteText)}
              disabled={!noteText || noteMutation.isPending}
              className="rounded bg-[#7FA88C] px-3 py-2 text-sm text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
