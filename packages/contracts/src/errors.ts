import { z } from "zod";

export const errorResponseSchema = z.object({
  error: z.object({
    id: z.string(),
    code: z.string(),
    message: z.string(),
  }),
});

export const paginationSchema = z.object({
  limit: z.number().int(),
  offset: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type Pagination = z.infer<typeof paginationSchema>;

/** Provider error codes — used when an integration is disabled */
export const PROVIDER_ERROR_CODES = [
  "provider_not_configured",
  "email_not_configured",
  "storage_not_configured",
  "kyc_not_configured",
  "signature_not_configured",
  "payments_not_configured",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];
