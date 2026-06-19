import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { apiFetch } from '../api/client';

interface OppItem {
  id: string;
  slug: string;
  title: string;
  editorial_status: string;
  visibility: string;
  status: string;
  risk_level: string;
  city: string;
  version: number;
  updated_at: string;
  created_at: string;
}

interface ListResponse {
  data: OppItem[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[#9B7E5F] text-[#08191C]', review: 'bg-[#7FA88C] text-[#08191C]',
  published: 'bg-[#7FA88C] text-[#08191C]', unlisted: 'bg-[#5C8D7A] text-[#FBF7F0]',
  private: 'bg-[#1A3E48] text-[#9B7E5F]', archived: 'bg-[#0F2A30] text-[#5C8D7A]',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', review: 'Revisión', published: 'Publicado',
  unlisted: 'No listado', private: 'Privado', archived: 'Archivado',
  coming_soon: 'Próximamente', open: 'Abierto', funding: 'Financiación',
  funded: 'Financiado', in_study: 'En estudio', in_execution: 'En ejecución', commercializing: 'Comercializando',
  closed: 'Cerrado', cancelled: 'Cancelado',
};

export default function AdminOpportunityList() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // The backend is the RBAC source of truth. Show admin actions in the admin
  // surface and let protected endpoints enforce admin/operator permissions.
  const isAdmin = true;

  const limit = 20;
  const offset = Number(searchParams.get('offset') || 0);
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'desc';
  const filterEditorial = searchParams.get('editorialStatus') || '';
  const filterSearch = searchParams.get('search') || '';

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), sort, order });
  if (filterEditorial) params.set('editorialStatus', filterEditorial);
  if (filterSearch) params.set('search', filterSearch);

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'opportunities', params.toString()],
    queryFn: () => apiFetch(`/api/v1/admin/opportunities?${params.toString()}`),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/admin/opportunities/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/admin/opportunities/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/admin/opportunities/${id}/archive`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'opportunities'] }),
  });

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('offset');
    setSearchParams(next);
  }

  const opps = data?.data ?? [];
  const pag = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-[#FBF7F0]">Oportunidades</h2>
        <Link to="/admin/oportunidades/nueva" className="rounded bg-[#7FA88C] px-4 py-2 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] focus:outline-2 focus:outline-[#7FA88C]">
          + Nueva oportunidad
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Buscar por título o slug…"
          value={filterSearch}
          onChange={(e) => setParam('search', e.target.value)}
          className="rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none"
        />
        <select value={filterEditorial} onChange={(e) => setParam('editorialStatus', e.target.value)} className="rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="review">Revisión</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
          <option value="created_at">Fecha creación</option>
          <option value="updated_at">Última actualización</option>
          <option value="title">Título</option>
        </select>
        <button onClick={() => setParam('order', order === 'asc' ? 'desc' : 'asc')} className="rounded border border-[#1A3E48] bg-[#08191C] px-3 py-2 text-sm text-[#FBF7F0] hover:bg-[#0F2A30]">
          {order === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Loading */}
      {isLoading && <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded bg-[#1A3E48]" />)}</div>}

      {/* Error */}
      {error && <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">Error al cargar oportunidades.</div>}

      {/* Empty */}
      {!isLoading && !error && opps.length === 0 && (
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-8 text-center">
          <p className="text-[#9B7E5F]">No hay oportunidades que coincidan con los filtros.</p>
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && opps.length > 0 && (
        <div className="hidden overflow-x-auto rounded border border-[#1A3E48] lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3E48] bg-[#08191C] text-left text-[#9B7E5F]">
                <th className="p-3 font-medium">Título</th>
                <th className="p-3 font-medium">Editorial</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Ciudad</th>
                <th className="p-3 font-medium">v.</th>
                <th className="p-3 font-medium">Actualizado</th>
                <th className="p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((opp) => (
                <tr key={opp.id} className="border-b border-[#0F2A30] text-[#FBF7F0] hover:bg-[#0F2A30]">
                  <td className="p-3">
                    <Link to={`/admin/oportunidades/${opp.id}`} className="text-[#7FA88C] hover:underline">{opp.title}</Link>
                    <div className="text-xs text-[#5C8D7A]">{opp.slug}</div>
                  </td>
                  <td className="p-3"><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[opp.editorial_status] || ''}`}>{STATUS_LABELS[opp.editorial_status] || opp.editorial_status}</span></td>
                  <td className="p-3 text-xs">{STATUS_LABELS[opp.status] || opp.status}</td>
                  <td className="p-3 text-xs">{opp.city}</td>
                  <td className="p-3 text-xs text-[#5C8D7A]">{opp.version}</td>
                  <td className="p-3 text-xs text-[#5C8D7A]">{new Date(opp.updated_at).toLocaleDateString('es-ES')}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Link to={`/admin/oportunidades/${opp.id}`} className="rounded bg-[#1A3E48] px-2 py-1 text-xs text-[#FBF7F0] hover:bg-[#0F2A30]">Editar</Link>
                      {isAdmin && opp.editorial_status !== 'published' && opp.editorial_status !== 'archived' && (
                        <button onClick={() => publishMutation.mutate(opp.id)} className="rounded bg-[#7FA88C] px-2 py-1 text-xs text-[#08191C] hover:bg-[#5C8D7A]">Publicar</button>
                      )}
                      {isAdmin && opp.editorial_status === 'published' && (
                        <button onClick={() => unpublishMutation.mutate(opp.id)} className="rounded bg-[#9B7E5F] px-2 py-1 text-xs text-[#08191C] hover:bg-[#B6946C]">Retirar</button>
                      )}
                      {isAdmin && opp.editorial_status !== 'archived' && (
                        <button onClick={() => { if (confirm('¿Archivar esta oportunidad?')) archiveMutation.mutate(opp.id); }} className="rounded bg-[#0F2A30] px-2 py-1 text-xs text-[#9B7E5F] hover:bg-[#1A3E48]">Archivar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!isLoading && opps.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {opps.map((opp) => (
            <div key={opp.id} className="rounded border border-[#1A3E48] bg-[#08191C] p-4">
              <Link to={`/admin/oportunidades/${opp.id}`} className="font-medium text-[#7FA88C] hover:underline">{opp.title}</Link>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 ${STATUS_BADGE[opp.editorial_status] || ''}`}>{STATUS_LABELS[opp.editorial_status] || opp.editorial_status}</span>
                <span className="text-[#5C8D7A]">{opp.city} · v{opp.version}</span>
              </div>
              <div className="mt-2 flex gap-1">
                <Link to={`/admin/oportunidades/${opp.id}`} className="rounded bg-[#1A3E48] px-2 py-1 text-xs text-[#FBF7F0]">Editar</Link>
                {isAdmin && opp.editorial_status !== 'published' && opp.editorial_status !== 'archived' && (
                  <button onClick={() => publishMutation.mutate(opp.id)} className="rounded bg-[#7FA88C] px-2 py-1 text-xs text-[#08191C]">Publicar</button>
                )}
                {isAdmin && opp.editorial_status === 'published' && (
                  <button onClick={() => unpublishMutation.mutate(opp.id)} className="rounded bg-[#9B7E5F] px-2 py-1 text-xs text-[#08191C]">Retirar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
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
