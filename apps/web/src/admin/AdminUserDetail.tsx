import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState } from 'react';

interface UserDetailData {
  public_reference: string;
  email: string;
  status: string;
  active_sessions: number;
  created_at: string;
  roles: string[];
  [key: string]: unknown;
}

interface ProjectAccessItem {
  opportunity_id: string;
  slug: string;
  title: string;
  opportunity_currency: string;
  target_amount_cents: number;
  project_committed_amount_cents: number;
  access_id: string | null;
  access_status: 'active' | 'revoked' | null;
  committed_amount_cents: number;
  currency: string;
  notes: string | null;
  granted_at: string | null;
  revoked_at: string | null;
}

function eurToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function centsToEur(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export default function AdminUserDetail() {
  const { reference } = useParams<{ reference: string }>();
  const queryClient = useQueryClient();
  const [addRole, setAddRole] = useState('');
  const [assignment, setAssignment] = useState({ opportunityId: '', amount: '', notes: '' });

  const { data, isLoading, error } = useQuery<{ data: UserDetailData }>({
    queryKey: ['admin', 'users', reference],
    queryFn: () => apiFetch(`/api/v1/admin/users/${reference}`),
    enabled: !!reference,
  });

  const { data: projectAccess } = useQuery<{ data: ProjectAccessItem[] }>({
    queryKey: ['admin', 'users', reference, 'project-access'],
    queryFn: () => apiFetch(`/api/v1/admin/users/${reference}/project-access`),
    enabled: !!reference && data?.data?.roles?.includes('investor'),
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

  const assignmentMutation = useMutation({
    mutationFn: (payload: { opportunityId: string; committedAmountCents: number; notes?: string | null; status?: 'active' | 'revoked' }) => apiFetch(`/api/v1/admin/users/${reference}/project-access`, { method: 'PUT', body: JSON.stringify({ currency: 'EUR', ...payload }) }),
    onSuccess: () => {
      setAssignment({ opportunityId: '', amount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', reference, 'project-access'] });
    },
  });

  if (isLoading) return <div className="animate-pulse text-[#9B7E5F]">Cargando usuario…</div>;
  if (error || !data) return <div className="text-[#9B7E5F]">Usuario no encontrado.</div>;

  const user = data.data;
  const roles = user.roles || [];
  const accesses = projectAccess?.data ?? [];
  const activeAssignments = accesses.filter((item) => item.access_status === 'active' && item.committed_amount_cents > 0);

  function submitAssignment() {
    if (!assignment.opportunityId) return;
    assignmentMutation.mutate({
      opportunityId: assignment.opportunityId,
      committedAmountCents: eurToCents(assignment.amount),
      notes: assignment.notes || null,
      status: 'active',
    });
  }

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
            <button onClick={() => { if (confirm('¿Revocar este usuario? Esta acción impedirá su acceso.')) statusMutation.mutate('revoked'); }} disabled={statusMutation.isPending} className="rounded bg-[#1A3E48] px-3 py-1.5 text-xs text-[#9B7E5F] hover:bg-[#0F2A30] disabled:opacity-50">Revocar</button>
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

      {roles.includes('investor') && (
        <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
          <h3 className="font-serif text-lg text-[#7FA88C]">Capital y acceso por proyecto</h3>
          <p className="mt-1 text-sm text-[#9B7E5F]">Asigna el capital comprometido real del inversor. Esto concede acceso al proyecto y actualiza el capital comprometido agregado del proyecto.</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.7fr_1fr_auto]">
            <select value={assignment.opportunityId} onChange={(e) => setAssignment((prev) => ({ ...prev, opportunityId: e.target.value }))} className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
              <option value="">Seleccionar proyecto…</option>
              {accesses.map((item) => <option key={item.opportunity_id} value={item.opportunity_id}>{item.title}</option>)}
            </select>
            <input value={assignment.amount} onChange={(e) => setAssignment((prev) => ({ ...prev, amount: e.target.value }))} inputMode="decimal" placeholder="Capital (€)" className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <input value={assignment.notes} onChange={(e) => setAssignment((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notas internas" className="rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none" />
            <button onClick={submitAssignment} disabled={!assignment.opportunityId || assignmentMutation.isPending} className="rounded bg-[#7FA88C] px-4 py-2 text-sm font-medium text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50">Asignar</button>
          </div>

          <div className="mt-5 overflow-x-auto rounded border border-[#1A3E48]">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#1A3E48] text-left text-[#9B7E5F]"><th className="p-3">Proyecto</th><th className="p-3">Estado</th><th className="p-3">Capital inversor</th><th className="p-3">Capital proyecto</th><th className="p-3">Acciones</th></tr></thead>
              <tbody>
                {activeAssignments.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-[#5C8D7A]">Sin capital asignado.</td></tr> : activeAssignments.map((item) => (
                  <tr key={item.opportunity_id} className="border-b border-[#0F2A30]">
                    <td className="p-3"><p className="font-medium text-[#FBF7F0]">{item.title}</p><p className="font-mono text-xs text-[#5C8D7A]">{item.slug}</p>{item.notes && <p className="mt-1 text-xs text-[#9B7E5F]">{item.notes}</p>}</td>
                    <td className="p-3 text-[#7FA88C]">{item.access_status}</td>
                    <td className="p-3 text-[#FBF7F0]">{centsToEur(item.committed_amount_cents)}</td>
                    <td className="p-3 text-[#5C8D7A]">{centsToEur(item.project_committed_amount_cents)}</td>
                    <td className="p-3"><button onClick={() => assignmentMutation.mutate({ opportunityId: item.opportunity_id, committedAmountCents: 0, status: 'revoked', notes: item.notes })} className="rounded border border-[#1A3E48] px-2 py-1 text-xs text-[#9B7E5F] hover:bg-[#0F2A30]">Revocar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
