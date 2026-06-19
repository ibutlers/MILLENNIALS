import { z } from "zod";
import { paginationSchema } from "./errors.js";

// ── Enums ──
export const opportunityStatusSchema = z.enum([
  "coming_soon", "open", "funding", "funded",
  "in_execution", "commercializing", "closed", "cancelled",
]);

export const riskLevelSchema = z.enum(["low", "medium", "high", "very_high"]);

export const returnTypeSchema = z.enum([
  "target_annual_return", "target_total_return", "target_irr", "target_roi",
]);

// ── Money & Percentage ──
export const moneyResponseSchema = z.object({
  cents: z.number().int(),
  currency: z.string().length(3),
  formatted: z.string(),
}).nullable();

export const percentageResponseSchema = z.object({
  basisPoints: z.number().int().nullable(),
  decimal: z.number().nullable(),
  formatted: z.string().nullable(),
});

// ── Sub-entities ──
export const mediaResponseSchema = z.object({
  type: z.string(),
  url: z.string(),
  altText: z.string(),
  position: z.number().int(),
});

export const highlightResponseSchema = z.object({
  label: z.string(),
  value: z.string(),
  position: z.number().int(),
});

export const riskResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
});

export const milestoneResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  plannedDate: z.string().nullable(),
  completedAt: z.string().nullable(),
  position: z.number().int(),
});

// ── Summary (list item) ──
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
  projectTotalAmount: moneyResponseSchema,
  bankFinancingAmount: moneyResponseSchema,
  minimumInvestment: moneyResponseSchema,
  estimatedTermMonths: z.number().int(),
  targetReturnType: returnTypeSchema,
  targetReturn: percentageResponseSchema,
  riskLevel: riskLevelSchema,
  closingDate: z.string().nullable(),
  publishedAt: z.string().nullable(),
  fundingProgress: z.number(),
  primaryImage: mediaResponseSchema.nullable(),
  disclaimer: z.string(),
});

// ── Detail ──
export const opportunityDetailSchema = opportunitySummarySchema.extend({
  description: z.string(),
  highlights: z.array(highlightResponseSchema),
  risks: z.array(riskResponseSchema),
  milestones: z.array(milestoneResponseSchema),
  media: z.array(mediaResponseSchema),
});

// ── Responses ──
export const opportunityListResponseSchema = z.object({
  data: z.array(opportunitySummarySchema),
  pagination: paginationSchema,
  meta: z.object({
    disclaimer: z.string(),
    allowedSorts: z.array(z.string()),
  }),
});

export const opportunityDetailResponseSchema = z.object({
  data: opportunityDetailSchema,
  meta: z.object({ disclaimer: z.string() }),
});

export const opportunityFiltersResponseSchema = z.object({
  data: z.object({
    statuses: z.array(opportunityStatusSchema),
    riskLevels: z.array(riskLevelSchema),
    targetReturnTypes: z.array(returnTypeSchema),
  }),
});

// ── Query params ──
export const opportunityListQuerySchema = z.object({
  status: opportunityStatusSchema.optional(),
  city: z.string().trim().min(1).max(80).optional(),
  assetType: z.string().trim().min(1).max(80).optional(),
  strategy: z.string().trim().min(1).max(80).optional(),
  riskLevel: riskLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  sort: z.enum(["publishedAt", "closingDate", "fundingProgress", "minimumInvestment", "targetAmount"]).default("publishedAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

// ── Inferred types ──
export type OpportunityStatus = z.infer<typeof opportunityStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type ReturnType = z.infer<typeof returnTypeSchema>;
export type MoneyResponse = z.infer<typeof moneyResponseSchema>;
export type PercentageResponse = z.infer<typeof percentageResponseSchema>;
export type MediaResponse = z.infer<typeof mediaResponseSchema>;
export type HighlightResponse = z.infer<typeof highlightResponseSchema>;
export type RiskResponse = z.infer<typeof riskResponseSchema>;
export type MilestoneResponse = z.infer<typeof milestoneResponseSchema>;
export type OpportunitySummary = z.infer<typeof opportunitySummarySchema>;
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;
export type OpportunityListResponse = z.infer<typeof opportunityListResponseSchema>;
export type OpportunityDetailResponse = z.infer<typeof opportunityDetailResponseSchema>;
export type OpportunityFiltersResponse = z.infer<typeof opportunityFiltersResponseSchema>;
export type OpportunityListQuery = z.infer<typeof opportunityListQuerySchema>;
