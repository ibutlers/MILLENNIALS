import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

interface AdminDashboardResponse {
  data: {
    opportunities: { total: number; published: number; drafts: number };
    leads: { new: number; unassigned: number };
    users: { active: number };
    sessions: { active: number };
    recentActivity: Array<{ event_type: string; entity_type: string; entity_reference: string; summary: string; created_at: string }>;
    warnings: string[];
  };
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
      <p className="text-sm text-[#9B7E5F]">{label}</p>
      <p className="mt-1 font-serif text-3xl text-[#7FA88C]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#5C8D7A]">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery<AdminDashboardResponse>({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => apiFetch('/api/v1/admin/dashboard'),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded bg-[#1A3E48]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-6 text-center">
        <p className="text-[#9B7E5F]">No se pudo cargar el resumen administrativo.</p>
        <p className="mt-1 text-sm text-[#5C8D7A]">{(error as Error)?.message || 'Error desconocido'}</p>
      </div>
    );
  }

  const d = data.data;

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-2xl text-[#FBF7F0]">Resumen operativo</h2>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Oportunidades totales" value={d.opportunities.total} sub={`${d.opportunities.published} publicadas · ${d.opportunities.drafts} borradores`} />
        <StatCard label="Leads nuevos" value={d.leads.new} sub={`${d.leads.unassigned} sin asignar`} />
        <StatCard label="Usuarios activos" value={d.users.active} />
        <StatCard label="Sesiones activas" value={d.sessions.active} />
      </div>

      {/* Warnings */}
      {d.warnings.length > 0 && (
        <div className="rounded border border-[#9B7E5F] bg-[#08191C] p-5">
          <h3 className="font-serif text-lg text-[#9B7E5F]">Avisos operativos</h3>
          <ul className="mt-2 space-y-1">
            {d.warnings.map((w, i) => (
              <li key={i} className="text-sm text-[#FBF7F0]">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
        <h3 className="font-serif text-lg text-[#FBF7F0]">Actividad reciente</h3>
        {d.recentActivity.length === 0 ? (
          <p className="mt-2 text-sm text-[#5C8D7A]">Sin actividad registrada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A3E48] text-left text-[#9B7E5F]">
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Evento</th>
                  <th className="pb-2 pr-4 font-medium">Entidad</th>
                  <th className="pb-2 font-medium">Resumen</th>
                </tr>
              </thead>
              <tbody>
                {d.recentActivity.map((event, i) => (
                  <tr key={i} className="border-b border-[#0F2A30] text-[#FBF7F0]">
                    <td className="py-2 pr-4 text-[#5C8D7A] whitespace-nowrap">{new Date(event.created_at).toLocaleString('es-ES')}</td>
                    <td className="py-2 pr-4 text-[#7FA88C]">{event.event_type}</td>
                    <td className="py-2 pr-4">{event.entity_type} / {event.entity_reference}</td>
                    <td className="py-2">{event.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
