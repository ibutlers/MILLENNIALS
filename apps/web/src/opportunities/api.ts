import { z } from 'zod';

const moneySchema = z.object({ cents: z.number().int(), currency: z.string().length(3), formatted: z.string() }).nullable();
const percentageSchema = z.object({ basisPoints: z.number().int().nullable(), decimal: z.number().nullable(), formatted: z.string().nullable() });
const mediaSchema = z.object({ type: z.string(), url: z.string(), altText: z.string(), position: z.number().int() }).nullable();

export const opportunitySummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  city: z.string(),
  countryCode: z.string(),
  district: z.string().nullable(),
  assetType: z.string(),
  strategy: z.string(),
  status: z.enum(['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'commercializing', 'closed', 'cancelled']),
  currency: z.string(),
  targetAmount: moneySchema,
  committedAmount: moneySchema,
  minimumInvestment: moneySchema,
  estimatedTermMonths: z.number().int(),
  targetReturnType: z.enum(['target_annual_return', 'target_total_return', 'target_irr', 'target_roi']),
  targetReturn: percentageSchema,
  riskLevel: z.enum(['low', 'medium', 'high', 'very_high']),
  closingDate: z.string().nullable(),
  publishedAt: z.string().nullable(),
  fundingProgress: z.number(),
  primaryImage: mediaSchema,
  disclaimer: z.string()
});

export const opportunitiesResponseSchema = z.object({
  data: z.array(opportunitySummarySchema),
  pagination: z.object({ limit: z.number().int(), offset: z.number().int(), total: z.number().int(), hasMore: z.boolean() }),
  meta: z.object({ disclaimer: z.string(), allowedSorts: z.array(z.string()) })
});

export type PublicOpportunity = z.infer<typeof opportunitySummarySchema>;
export type OpportunitiesResponse = z.infer<typeof opportunitiesResponseSchema>;

export async function fetchPublicOpportunities(signal?: AbortSignal): Promise<OpportunitiesResponse> {
  const response = await fetch('/api/v1/opportunities?limit=3&sort=publishedAt&direction=desc', {
    signal,
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las oportunidades públicas.');
  }

  return opportunitiesResponseSchema.parse(await response.json());
}

export function riskLabel(risk: PublicOpportunity['riskLevel']) {
  return { low: 'Bajo', medium: 'Medio', high: 'Alto', very_high: 'Muy alto' }[risk];
}

export function statusLabel(status: PublicOpportunity['status']) {
  return {
    coming_soon: 'Próximamente',
    open: 'Abierta',
    funding: 'En financiación',
    funded: 'Financiada',
    in_execution: 'En ejecución',
    commercializing: 'En comercialización',
    closed: 'Cerrada',
    cancelled: 'Cancelada'
  }[status];
}

export function returnTypeLabel(type: PublicOpportunity['targetReturnType']) {
  return {
    target_annual_return: 'Rentabilidad anual objetivo estimada',
    target_total_return: 'Rentabilidad total objetivo estimada',
    target_irr: 'TIR objetivo estimada',
    target_roi: 'ROI objetivo estimado'
  }[type];
}
