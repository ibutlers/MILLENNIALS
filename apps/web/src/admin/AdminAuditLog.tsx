import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../api/client';

interface AuditEvent {
  id: string;
  actor_id: string;
  event_type: string;
  entity_type: string;
  entity_reference: string;
  summary: string;
  created_at: string;
}

interface ListResponse {
  data: AuditEvent[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

export default function AdminAuditLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = 30;
  const offset = Number(searchParams.get('offset') || 0);

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'audit', params.toString()],
    queryFn: () => apiFetch(`/api/v1/admin/audit?${params.toString()}`),
  });

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('offset');
    setSearchParams(next);
  }

  const events = data?.data ?? [];
  const pag = data?.pagination;

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-[#FBF7F0]">Auditoría</h2>

      {isLoading && <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded bg-[#1A3E48]" />)}</div>}
      {error && <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">Error al cargar auditoría.</div>}

      {!isLoading && events.length === 0 && (
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-8 text-center">
          <p className="text-[#9B7E5F]">No hay eventos de auditoría registrados.</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#1A3E48]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3E48] bg-[#08191C] text-left text-[#9B7E5F]">
                <th className="p-3 font-medium">Fecha</th>
                <th className="p-3 font-medium">Evento</th>
                <th className="p-3 font-medium">Entidad</th>
                <th className="p-3 font-medium">Resumen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[#0F2A30] hover:bg-[#0F2A30]">
                  <td className="p-3 text-xs text-[#5C8D7A] whitespace-nowrap">{new Date(e.created_at).toLocaleString('es-ES')}</td>
                  <td className="p-3 text-xs text-[#7FA88C]">{e.event_type}</td>
                  <td className="p-3 text-xs text-[#FBF7F0]">{e.entity_type}/{e.entity_reference}</td>
                  <td className="p-3 text-xs text-[#FBF7F0]">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pag && pag.total > 0 && (
        <div className="flex items-center justify-between text-sm text-[#9B7E5F]">
          <span>{pag.total} eventos</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setParam('offset', String(Math.max(0, offset - limit)))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Anterior</button>
            <button disabled={!pag.hasMore} onClick={() => setParam('offset', String(offset + limit))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
