import { z } from 'zod';

const moneySchema = z.object({ cents: z.number().int(), currency: z.string().length(3), formatted: z.string() }).nullable();
const percentageSchema = z.object({ basisPoints: z.number().int().nullable(), decimal: z.number().nullable(), formatted: z.string().nullable() });
const mediaSchema = z.object({ type: z.string(), url: z.string(), altText: z.string(), position: z.number().int() });
const nullableMediaSchema = mediaSchema.nullable();

export const opportunityStatusSchema = z.enum(['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'in_study', 'commercializing', 'closed', 'cancelled']);
export const opportunityRiskSchema = z.enum(['low', 'medium', 'high', 'very_high']);
export const opportunityReturnTypeSchema = z.enum(['target_annual_return', 'target_total_return', 'target_irr', 'target_roi']);

export const opportunitySummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  city: z.string(),
  countryCode: z.string(),
  district: z.string().nullable(),
  assetType: z.string(),
  strategy: z.string(),
  status: opportunityStatusSchema,
  currency: z.string(),
  targetAmount: moneySchema,
  committedAmount: moneySchema,
  minimumInvestment: moneySchema,
  estimatedTermMonths: z.number().int(),
  targetReturnType: opportunityReturnTypeSchema,
  targetReturn: percentageSchema,
  riskLevel: opportunityRiskSchema,
  closingDate: z.string().nullable(),
  publishedAt: z.string().nullable(),
  fundingProgress: z.number(),
  primaryImage: nullableMediaSchema,
  disclaimer: z.string()
});

export const opportunitiesResponseSchema = z.object({
  data: z.array(opportunitySummarySchema),
  pagination: z.object({ limit: z.number().int(), offset: z.number().int(), total: z.number().int(), hasMore: z.boolean() }),
  meta: z.object({ disclaimer: z.string(), allowedSorts: z.array(z.string()) })
});

const highlightSchema = z.object({ label: z.string(), value: z.string(), position: z.number().int() });
const riskSchema = z.object({ title: z.string(), description: z.string(), position: z.number().int() });
const milestoneSchema = z.object({ title: z.string(), description: z.string(), plannedDate: z.string().nullable(), completedAt: z.string().nullable(), position: z.number().int() });

export const opportunityDetailSchema = opportunitySummarySchema.extend({
  description: z.string(),
  highlights: z.array(highlightSchema),
  risks: z.array(riskSchema),
  milestones: z.array(milestoneSchema),
  media: z.array(mediaSchema)
});

export const opportunityDetailResponseSchema = z.object({
  data: opportunityDetailSchema,
  meta: z.object({ disclaimer: z.string() })
});

export type PublicOpportunity = z.infer<typeof opportunitySummarySchema>;
export type OpportunitiesResponse = z.infer<typeof opportunitiesResponseSchema>;
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;
export type OpportunityDetailResponse = z.infer<typeof opportunityDetailResponseSchema>;
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export type OpportunityRisk = z.infer<typeof opportunityRiskSchema>;
export type OpportunityReturnType = z.infer<typeof opportunityReturnTypeSchema>;

export type OpportunityListParams = {
  status?: string;
  city?: string;
  assetType?: string;
  strategy?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
};

const allowedParamKeys = ['status', 'city', 'assetType', 'strategy', 'riskLevel', 'limit', 'offset', 'sort', 'direction'] as const;

export function buildOpportunitiesUrl(params: OpportunityListParams = {}) {
  const search = new URLSearchParams();
  for (const key of allowedParamKeys) {
    const value = params[key];
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return `/api/v1/opportunities${query ? `?${query}` : ''}`;
}

export async function fetchPublicOpportunities(signal?: AbortSignal, params: OpportunityListParams = {}): Promise<OpportunitiesResponse> {
  const response = await fetch(buildOpportunitiesUrl({ limit: 3, sort: 'publishedAt', direction: 'desc', ...params }), {
    signal,
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las oportunidades públicas.');
  }

  return opportunitiesResponseSchema.parse(await response.json());
}

export async function fetchOpportunityDetail(slug: string, signal?: AbortSignal): Promise<OpportunityDetailResponse> {
  const response = await fetch(`/api/v1/opportunities/${encodeURIComponent(slug)}`, {
    signal,
    headers: { Accept: 'application/json' }
  });

  if (response.status === 404) {
    throw new Error('not_found');
  }
  if (!response.ok) {
    throw new Error('No se pudo cargar la oportunidad pública.');
  }

  return opportunityDetailResponseSchema.parse(await response.json());
}

export function riskLabel(risk: OpportunityRisk) {
  return { low: 'Bajo', medium: 'Medio', high: 'Alto', very_high: 'Muy alto' }[risk];
}

export function statusLabel(status: OpportunityStatus) {
  return {
    coming_soon: 'Próximamente',
    open: 'Abierta',
    funding: 'En financiación',
    funded: 'Financiada',
    in_execution: 'En ejecución',
    in_study: 'En estudio',
    commercializing: 'En comercialización',
    closed: 'Cerrada',
    cancelled: 'Cancelada'
  }[status];
}

export function returnTypeLabel(type: OpportunityReturnType) {
  return {
    target_annual_return: 'Rentabilidad total objetivo estimada',
    target_total_return: 'Rentabilidad total objetivo estimada',
    target_irr: 'Rentabilidad total objetivo estimada',
    target_roi: 'Rentabilidad total objetivo estimada'
  }[type];
}

export function formatReturnValue(value: { formatted: string | null }) {
  return value.formatted ? `${value.formatted} +50%*` : '—';
}

export function formatDate(value: string | null) {
  if (!value) return 'No publicada';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatProgress(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(Math.max(0, Math.min(100, value))) + '%';
}
