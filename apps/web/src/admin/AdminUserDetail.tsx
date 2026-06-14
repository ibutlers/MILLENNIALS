import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState } from 'react';

interface UserDetailData {
  email: string;
  status: string;
  active_sessions: number;
  created_at: string;
  roles: string[];
  [key: string]: unknown;
}

export default function AdminUserDetail() {
  const { reference } = useParams<{ reference: string }>();
  const queryClient = useQueryClient();
  const [addRole, setAddRole] = useState('');

  const { data, isLoading, error } = useQuery<{ data: UserDetailData }>({
    queryKey: ['admin', 'users', reference],
    queryFn: () => apiFetch(`/api/v1/admin/users/${reference}`),
    enabled: !!reference,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiFetch(`/api/v1/admin/users/${reference}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const roleAddMutation = useMutation({
    mutationFn: (role: string) => apiFetch(`/api/v1/admin/users/${reference}/roles`, { method: 'POST', body: JSON.stringify({ role }) }),
    onSuccess: () => { setAddRole(''); queryClient.invalidateQueries({ queryKey: ['admin', 'users', reference] }); },
  });

  const roleRemoveMutation = useMutation({
    mutationFn: (role: string) => apiFetch(`/api/v1/admin/users/${reference}/roles/${role}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', reference] }),
  });

  const revokeMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/admin/users/${reference}/sessions`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', reference] }),
  });

  if (isLoading) return <div className="animate-pulse text-[#9B7E5F]">Cargando usuario…</div>;
  if (error || !data) return <div className="text-[#9B7E5F]">Usuario no encontrado.</div>;

  const user = data.data;
  const roles = user.roles || [];

  return (
    <div className="space-y-6">
      <Link to="/admin/usuarios" className="text-sm text-[#7FA88C] hover:underline">← Volver al listado</Link>
      <h2 className="font-serif text-2xl text-[#FBF7F0]">Usuario <span className="font-mono text-[#7FA88C]">{user.email}</span></h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5 space-y-3">
          <h3 className="font-serif text-lg text-[#7FA88C]">Detalles</h3>
          <div><span className="text-sm text-[#9B7E5F]">Email:</span><span className="ml-2 text-sm text-[#FBF7F0]">{user.email}</span></div>
          <div><span className="text-sm text-[#9B7E5F]">Estado:</span><span className="ml-2 text-sm text-[#7FA88C]">{user.status}</span></div>
          <div><span className="text-sm text-[#9B7E5F]">Sesiones activas:</span><span className="ml-2 text-sm text-[#FBF7F0]">{user.active_sessions ?? 0}</span></div>
          <div><span className="text-sm text-[#9B7E5F]">Registro:</span><span className="ml-2 text-sm text-[#FBF7F0]">{new Date(user.created_at).toLocaleDateString('es-ES')}</span></div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending} className="rounded bg-[#7FA88C] px-3 py-1.5 text-xs text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50">Activar</button>
            <button onClick={() => statusMutation.mutate('suspended')} disabled={statusMutation.isPending} className="rounded bg-[#9B7E5F] px-3 py-1.5 text-xs text-[#08191C] hover:bg-[#B6946C] disabled:opacity-50">Suspender</button>
            <button onClick={() => { if (confirm('¿Deshabilitar este usuario?')) statusMutation.mutate('disabled'); }} disabled={statusMutation.isPending} className="rounded bg-[#1A3E48] px-3 py-1.5 text-xs text-[#9B7E5F] hover:bg-[#0F2A30] disabled:opacity-50">Deshabilitar</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Roles</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((role: string) => (
                <span key={role} className="inline-flex items-center gap-1 rounded bg-[#0F2A30] px-3 py-1 text-sm text-[#FBF7F0]">
                  {role}
                  {role !== 'admin' || roles.filter((r: string) => r === 'admin').length > 1 ? (
                    <button onClick={() => roleRemoveMutation.mutate(role)} className="ml-1 text-[#9B7E5F] hover:text-[#B6946C]" aria-label={`Quitar rol ${role}`}>×</button>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-1.5 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
                <option value="">Añadir rol…</option>
                <option value="investor">investor</option><option value="operator">operator</option><option value="admin">admin</option>
              </select>
              <button onClick={() => addRole && roleAddMutation.mutate(addRole)} disabled={!addRole || roleAddMutation.isPending} className="rounded bg-[#7FA88C] px-3 py-1.5 text-sm text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50">Añadir</button>
            </div>
          </div>

          <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Sesiones</h3>
            <p className="mt-1 text-sm text-[#5C8D7A]">Sesiones activas: {user.active_sessions ?? 0}</p>
            <button
              onClick={() => { if (confirm('¿Revocar todas las sesiones de este usuario?')) revokeMutation.mutate(); }}
              disabled={revokeMutation.isPending || (user.active_sessions ?? 0) === 0}
              className="mt-2 rounded bg-[#9B7E5F] px-3 py-1.5 text-sm text-[#08191C] hover:bg-[#B6946C] disabled:opacity-50"
            >
              Revocar todas las sesiones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
