import { z } from 'zod';

export const opportunityStatusSchema = z.enum(['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'commercializing', 'closed', 'cancelled']);
export const opportunityVisibilitySchema = z.enum(['public', 'private', 'unlisted', 'draft']);
export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'very_high']);
export const returnTypeSchema = z.enum(['target_annual_return', 'target_total_return', 'target_irr', 'target_roi']);
export const sortSchema = z.enum(['publishedAt', 'closingDate', 'fundingProgress', 'minimumInvestment', 'targetAmount']).default('publishedAt');
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

export const opportunityListQuerySchema = z.object({
  status: opportunityStatusSchema.optional(),
  city: z.string().trim().min(1).max(80).optional(),
  assetType: z.string().trim().min(1).max(80).optional(),
  strategy: z.string().trim().min(1).max(80).optional(),
  riskLevel: riskLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  sort: sortSchema,
  direction: sortDirectionSchema
}).strict();

export const slugParamsSchema = z.object({ slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

export const moneyResponseSchema = z.object({ cents: z.number().int(), currency: z.string().length(3), formatted: z.string() }).nullable();
export const percentageResponseSchema = z.object({ basisPoints: z.number().int().nullable(), decimal: z.number().nullable(), formatted: z.string().nullable() });

export const mediaResponseSchema = z.object({ type: z.string(), url: z.string(), altText: z.string(), position: z.number().int() });
export const highlightResponseSchema = z.object({ label: z.string(), value: z.string(), position: z.number().int() });
export const riskResponseSchema = z.object({ title: z.string(), description: z.string(), position: z.number().int() });
export const milestoneResponseSchema = z.object({ title: z.string(), description: z.string(), plannedDate: z.string().nullable(), completedAt: z.string().nullable(), position: z.number().int() });

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
  targetAmount: moneyResponseSchema,
  committedAmount: moneyResponseSchema,
  minimumInvestment: moneyResponseSchema,
  estimatedTermMonths: z.number().int(),
  targetReturnType: returnTypeSchema,
  targetReturn: percentageResponseSchema,
  riskLevel: riskLevelSchema,
  closingDate: z.string().nullable(),
  publishedAt: z.string().nullable(),
  fundingProgress: z.number(),
  primaryImage: mediaResponseSchema.nullable(),
  disclaimer: z.string()
});

export const opportunityDetailSchema = opportunitySummarySchema.extend({
  description: z.string(),
  highlights: z.array(highlightResponseSchema),
  risks: z.array(riskResponseSchema),
  milestones: z.array(milestoneResponseSchema),
  media: z.array(mediaResponseSchema)
});

export const opportunityListResponseSchema = z.object({
  data: z.array(opportunitySummarySchema),
  pagination: z.object({ limit: z.number().int(), offset: z.number().int(), total: z.number().int(), hasMore: z.boolean() }),
  meta: z.object({ disclaimer: z.string(), allowedSorts: z.array(z.string()) })
});

export const opportunityDetailResponseSchema = z.object({ data: opportunityDetailSchema, meta: z.object({ disclaimer: z.string() }) });

export const errorResponseSchema = z.object({ error: z.object({ id: z.string(), code: z.string(), message: z.string() }) });

export const opportunityFiltersResponseSchema = z.object({
  data: z.object({
    statuses: z.array(opportunityStatusSchema),
    riskLevels: z.array(riskLevelSchema),
    targetReturnTypes: z.array(returnTypeSchema)
  })
});
