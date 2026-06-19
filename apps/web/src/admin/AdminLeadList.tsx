import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { apiFetch } from '../api/client';

interface LeadItem {
  id: string;
  public_reference: string;
  kind: string;
  status: string;
  opportunity_id: string | null;
  assigned_user_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  source_path: string | null;
  profile: string | null;
  experience: string | null;
  interests: string | null;
  created_at: string;
}

interface ListResponse {
  data: LeadItem[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo', in_review: 'En revisión', contacted: 'Contactado',
  qualified: 'Cualificado', disqualified: 'Descartado', converted: 'Convertido',
};

const KIND_LABELS: Record<string, string> = {
  investor_interest: 'Solicitud de acceso',
  access_request: 'Solicitud de acceso',
  opportunity_inquiry: 'Consulta de proyecto',
  general_contact: 'Contacto general',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-[#7FA88C] text-[#08191C]', contacted: 'bg-[#7FA88C] text-[#08191C]',
  qualified: 'bg-[#5C8D7A] text-[#FBF7F0]', converted: 'bg-[#9B7E5F] text-[#08191C]',
  disqualified: 'bg-[#1A3E48] text-[#9B7E5F]', in_review: 'bg-[#B6946C] text-[#08191C]',
};

function leadName(lead: LeadItem): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre';
}

export default function AdminLeadList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = 20;
  const offset = Number(searchParams.get('offset') || 0);
  const filterStatus = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filterStatus) params.set('status', filterStatus);
  if (search) params.set('search', search);

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'leads', params.toString()],
    queryFn: () => apiFetch(`/api/v1/admin/leads?${params.toString()}`),
  });

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('offset');
    setSearchParams(next);
  }

  const leads = data?.data ?? [];
  const pag = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-[#FBF7F0]">Solicitudes y leads</h2>
        <p className="mt-1 text-sm text-[#9B7E5F]">
          Aquí aparecen las solicitudes enviadas desde “Acceso inversores / Coinvierte” y los formularios de contacto.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="lead-search">Buscar solicitud</label>
        <input
          id="lead-search"
          type="search"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          placeholder="Buscar por nombre, email o referencia"
          className="min-w-[260px] rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none"
        />
        <select value={filterStatus} onChange={(e) => setParam('status', e.target.value)} className="rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
          <option value="">Todos los estados</option>
          <option value="new">Nuevo</option><option value="in_review">En revisión</option><option value="contacted">Contactado</option>
          <option value="qualified">Cualificado</option><option value="disqualified">Descartado</option><option value="converted">Convertido</option>
        </select>
      </div>

      {isLoading && <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded bg-[#1A3E48]" />)}</div>}
      {error && <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">Error al cargar solicitudes.</div>}

      {!isLoading && leads.length === 0 && (
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-8 text-center">
          <p className="text-[#9B7E5F]">No hay solicitudes con estos filtros.</p>
        </div>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#1A3E48]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3E48] bg-[#08191C] text-left text-[#9B7E5F]">
                <th className="p-3 font-medium">Solicitante</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Origen</th>
                <th className="p-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-[#0F2A30] hover:bg-[#0F2A30]">
                  <td className="p-3 align-top">
                    <Link to={`/admin/leads/${lead.public_reference}`} className="font-medium text-[#7FA88C] hover:underline">
                      {leadName(lead)}
                    </Link>
                    <div className="mt-1 font-mono text-xs text-[#5C8D7A]">{lead.public_reference}</div>
                    {lead.email && <div className="mt-1 text-xs text-[#FBF7F0]/80">{lead.email}</div>}
                    {lead.profile && <div className="mt-1 text-xs text-[#9B7E5F]">{lead.profile}</div>}
                  </td>
                  <td className="p-3 align-top text-xs text-[#FBF7F0]">{KIND_LABELS[lead.kind] || lead.kind}</td>
                  <td className="p-3 align-top">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] || ''}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="p-3 align-top text-xs text-[#5C8D7A]">{lead.source_path || '—'}</td>
                  <td className="p-3 align-top text-xs text-[#5C8D7A]">
                    {new Date(lead.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pag && pag.total > 0 && (
        <div className="flex items-center justify-between text-sm text-[#9B7E5F]">
          <span>{pag.total} resultados</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setParam('offset', String(Math.max(0, offset - limit)))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Anterior</button>
            <button disabled={!pag.hasMore} onClick={() => setParam('offset', String(offset + limit))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
