import { z } from 'zod';

export const leadKindSchema = z.enum(['access_request', 'opportunity_inquiry', 'general_contact']);
export type LeadKind = z.infer<typeof leadKindSchema>;

export const leadSettingsSchema = z.object({ data: z.object({ enabled: z.boolean(), privacyPolicyVersion: z.string(), controllerConfigured: z.boolean(), privacyContactConfigured: z.boolean() }) });
export type LeadSettings = z.infer<typeof leadSettingsSchema>['data'];

export const leadCreatedSchema = z.object({ data: z.object({ publicReference: z.string(), kind: leadKindSchema, status: z.literal('new'), createdAt: z.string(), message: z.string() }) });
export type LeadCreated = z.infer<typeof leadCreatedSchema>['data'];

export type LeadPayload = {
  kind: LeadKind;
  opportunitySlug?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  countryCode?: string;
  investmentRange?: string;
  message?: string;
  sourcePath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  privacyAccepted: true;
  marketingOptIn: boolean;
  riskAcknowledged?: boolean;
  submittedAfterMs: number;
  website: string;
};

export async function fetchLeadSettings(signal?: AbortSignal): Promise<LeadSettings> {
  const response = await fetch('/api/v1/lead-settings', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('No se pudo comprobar la disponibilidad de solicitudes.');
  return leadSettingsSchema.parse(await response.json()).data;
}

export async function submitLead(payload: LeadPayload, signal?: AbortSignal): Promise<LeadCreated> {
  const response = await fetch('/api/v1/leads', {
    method: 'POST',
    signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.error?.code;
    if (response.status === 503 || code === 'leads_disabled') throw new Error('disabled');
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error('invalid');
  }
  return leadCreatedSchema.parse(body).data;
}

// ── Contact form ──

export const contactSubjectEnum = z.enum(['Consulta general', 'Presentar un proyecto', 'Colaboración profesional', 'Otro']);
export type ContactSubject = z.infer<typeof contactSubjectEnum>;

export type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  subject: ContactSubject;
  message: string;
  consent: true;
  submittedAfterMs: number;
  website: string;
};

export const contactCreatedSchema = z.object({
  data: z.object({
    publicReference: z.string(),
    status: z.literal('new'),
    createdAt: z.string(),
    message: z.string()
  })
});
export type ContactCreated = z.infer<typeof contactCreatedSchema>['data'];

export async function submitContact(payload: ContactPayload, signal?: AbortSignal): Promise<ContactCreated> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error('invalid');
  }
  return contactCreatedSchema.parse(body).data;
}
