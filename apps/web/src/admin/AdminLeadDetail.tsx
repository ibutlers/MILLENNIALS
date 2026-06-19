import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { apiFetch } from '../api/client';
import { useState } from 'react';

interface LeadNote {
  id: string;
  body?: string;
  content?: string;
  author_id: string | null;
  created_at: string;
}

interface LeadDetail {
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
  country_code: string | null;
  investment_range: string | null;
  message: string | null;
  source_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  privacy_policy_version: string | null;
  privacy_accepted_at: string | null;
  risk_acknowledged_at: string | null;
  marketing_opt_in_at: string | null;
  subject: string | null;
  profile: string | null;
  experience: string | null;
  interests: string | null;
  consent_version: string | null;
  consent_accepted_at: string | null;
  created_at: string;
  updated_at: string | null;
  notes?: LeadNote[];
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  in_review: 'En revisión',
  contacted: 'Contactado',
  qualified: 'Cualificado',
  disqualified: 'Descartado',
  converted: 'Convertido',
};

const KIND_LABELS: Record<string, string> = {
  investor_interest: 'Solicitud de acceso / Coinvierte',
  access_request: 'Solicitud de acceso',
  opportunity_inquiry: 'Consulta de proyecto',
  general_contact: 'Contacto general',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatValue(value?: string | number | boolean | null): string {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function DetailRow({ label, value, multiline = false }: { label: string; value?: string | number | boolean | null; multiline?: boolean }) {
  return (
    <div className="border-b border-[#1A3E48] py-2 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-[#9B7E5F]">{label}</dt>
      <dd className={`mt-1 text-sm text-[#FBF7F0] ${multiline ? 'whitespace-pre-wrap leading-6' : 'break-words'}`}>{formatValue(value)}</dd>
    </div>
  );
}

function leadName(lead: LeadDetail): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre';
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

  if (isLoading) return <div className="animate-pulse text-[#9B7E5F]">Cargando solicitud…</div>;
  if (error || !data) return <div className="text-[#9B7E5F]">Solicitud no encontrada.</div>;

  const lead = data.data;
  const marketingOptIn = Boolean(lead.marketing_opt_in_at);
  const privacyAccepted = Boolean(lead.privacy_accepted_at || lead.consent_accepted_at);
  const riskAcknowledged = Boolean(lead.risk_acknowledged_at);

  return (
    <div className="space-y-6">
      <Link to="/admin/leads" className="text-sm text-[#7FA88C] hover:underline">← Volver al listado</Link>
      <div>
        <h2 className="font-serif text-2xl text-[#FBF7F0]">Solicitud <span className="font-mono text-[#7FA88C]">{lead.public_reference}</span></h2>
        <p className="mt-1 text-sm text-[#9B7E5F]">Todos los datos capturados del formulario, incluyendo campos opcionales y consentimientos.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Datos del solicitante</h3>
            <dl className="mt-4 grid gap-x-6 md:grid-cols-2">
              <DetailRow label="Nombre" value={leadName(lead)} />
              <DetailRow label="Email" value={lead.email} />
              <DetailRow label="Teléfono" value={lead.phone} />
              <DetailRow label="País" value={lead.country_code} />
            </dl>
          </section>

          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Solicitud</h3>
            <dl className="mt-4 grid gap-x-6 md:grid-cols-2">
              <DetailRow label="Referencia" value={lead.public_reference} />
              <DetailRow label="Tipo" value={KIND_LABELS[lead.kind] || lead.kind} />
              <DetailRow label="Estado" value={STATUS_LABELS[lead.status] || lead.status} />
              <DetailRow label="Proyecto / oportunidad" value={lead.opportunity_id} />
              <DetailRow label="Perfil" value={lead.profile} />
              <DetailRow label="Experiencia" value={lead.experience} />
              <DetailRow label="Rango de inversión" value={lead.investment_range} />
              <DetailRow label="Asunto" value={lead.subject} />
              <div className="md:col-span-2">
                <DetailRow label="Intereses" value={lead.interests} multiline />
              </div>
              <div className="md:col-span-2">
                <DetailRow label="Mensaje" value={lead.message} multiline />
              </div>
            </dl>
          </section>

          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Origen y trazabilidad</h3>
            <dl className="mt-4 grid gap-x-6 md:grid-cols-2">
              <DetailRow label="Página de origen" value={lead.source_path} />
              <DetailRow label="Referrer" value={lead.referrer} />
              <DetailRow label="UTM source" value={lead.utm_source} />
              <DetailRow label="UTM medium" value={lead.utm_medium} />
              <DetailRow label="UTM campaign" value={lead.utm_campaign} />
              <DetailRow label="Creado" value={formatDate(lead.created_at)} />
              <DetailRow label="Actualizado" value={formatDate(lead.updated_at)} />
            </dl>
          </section>

          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Consentimientos</h3>
            <dl className="mt-4 grid gap-x-6 md:grid-cols-2">
              <DetailRow label="Privacidad aceptada" value={privacyAccepted} />
              <DetailRow label="Versión privacidad" value={lead.privacy_policy_version || lead.consent_version} />
              <DetailRow label="Fecha privacidad" value={formatDate(lead.privacy_accepted_at || lead.consent_accepted_at)} />
              <DetailRow label="Marketing" value={marketingOptIn} />
              <DetailRow label="Fecha marketing" value={formatDate(lead.marketing_opt_in_at)} />
              <DetailRow label="Riesgo reconocido" value={riskAcknowledged} />
              <DetailRow label="Fecha riesgo" value={formatDate(lead.risk_acknowledged_at)} />
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5 space-y-3">
            <h3 className="font-serif text-lg text-[#7FA88C]">Gestión</h3>
            <div className="flex gap-2 pt-2">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="min-w-0 flex-1 rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-1.5 text-sm text-[#FBF7F0] focus:border-[#7FA88C] focus:outline-none">
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
          </section>

          <section className="rounded border border-[#1A3E48] bg-[#08191C] p-5">
            <h3 className="font-serif text-lg text-[#7FA88C]">Notas</h3>
            {lead.notes && lead.notes.length > 0 ? (
              <div className="mt-3 space-y-3">
                {lead.notes.map((note) => (
                  <div key={note.id} className="rounded bg-[#0F2A30] p-3">
                    <p className="text-sm text-[#FBF7F0]">{note.body || note.content}</p>
                    <p className="mt-1 text-xs text-[#5C8D7A]">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#5C8D7A]">Sin notas.</p>
            )}
            <div className="mt-4 space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Añadir nota operativa…"
                rows={3}
                className="w-full rounded border border-[#1A3E48] bg-[#0F2A30] px-3 py-2 text-sm text-[#FBF7F0] placeholder:text-[#5C8D7A] focus:border-[#7FA88C] focus:outline-none"
              />
              <button
                onClick={() => noteText && noteMutation.mutate(noteText)}
                disabled={!noteText || noteMutation.isPending}
                className="w-full rounded bg-[#7FA88C] px-3 py-2 text-sm text-[#08191C] hover:bg-[#5C8D7A] disabled:opacity-50"
              >
                Añadir nota
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
