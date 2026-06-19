import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { apiFetch } from '../api/client';

interface UserItem {
  id: string;
  public_reference: string;
  email: string;
  status: string;
  roles: string[];
  email_verified_at: string | null;
  created_at: string;
}

interface ListResponse {
  data: UserItem[];
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#7FA88C] text-[#08191C]', suspended: 'bg-[#9B7E5F] text-[#08191C]', revoked: 'bg-[#1A3E48] text-[#9B7E5F]',
};

export default function AdminUserList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const limit = 20;
  const offset = Number(searchParams.get('offset') || 0);

  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'users', params.toString()],
    queryFn: () => apiFetch(`/api/v1/admin/users?${params.toString()}`),
  });

  function setParam(k: string, v: string) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('offset');
    setSearchParams(next);
  }

  const users = data?.data ?? [];
  const pag = data?.pagination;

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-[#FBF7F0]">Usuarios</h2>

      {isLoading && <div className="animate-pulse space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded bg-[#1A3E48]" />)}</div>}
      {error && <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-4 text-[#9B7E5F]">Error al cargar usuarios.</div>}

      {!isLoading && users.length === 0 && (
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-8 text-center">
          <p className="text-[#9B7E5F]">No hay usuarios registrados.</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#1A3E48]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3E48] bg-[#08191C] text-left text-[#9B7E5F]">
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Roles</th>
                <th className="p-3 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#0F2A30] hover:bg-[#0F2A30]">
                  <td className="p-3">
                    <Link to={`/admin/usuarios/${u.public_reference}`} className="text-[#7FA88C] hover:underline font-mono text-xs">
                      {u.email}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.status] || ''}`}>{u.status}</span>
                  </td>
                  <td className="p-3 text-xs text-[#FBF7F0]">{(u.roles || []).join(', ') || '—'}</td>
                  <td className="p-3 text-xs text-[#5C8D7A]">{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pag && pag.total > 0 && (
        <div className="flex items-center justify-between text-sm text-[#9B7E5F]">
          <span>{pag.total} usuarios</span>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setParam('offset', String(Math.max(0, offset - limit)))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Anterior</button>
            <button disabled={!pag.hasMore} onClick={() => setParam('offset', String(offset + limit))} className="rounded border border-[#1A3E48] px-3 py-1 disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
