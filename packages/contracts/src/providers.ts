import { z } from "zod";

// ── Provider status ──
export const providerHealthSchema = z.object({
  configured: z.boolean(),
  status: z.enum(["ok", "not_configured", "error"]),
  message: z.string().optional(),
});

export const providersHealthResponseSchema = z.object({
  email: providerHealthSchema,
  storage: providerHealthSchema,
  kyc: providerHealthSchema,
  signature: providerHealthSchema,
  payments: providerHealthSchema,
});

// ── Email provider ──
export const emailSendParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string().optional(),
});

export type EmailSendParams = z.infer<typeof emailSendParamsSchema>;

// ── Storage provider ──
export const storageUploadResultSchema = z.object({
  key: z.string(),
  url: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const storageMetadataSchema = z.object({
  key: z.string(),
  size: z.number(),
  contentType: z.string(),
  lastModified: z.string(),
});

export type StorageUploadResult = z.infer<typeof storageUploadResultSchema>;
export type StorageMetadata = z.infer<typeof storageMetadataSchema>;

// ── KYC provider ──
export const kycStatusSchema = z.enum([
  "not_started", "pending", "in_review", "approved", "rejected", "expired",
]);

export const kycInitiateResultSchema = z.object({
  providerReference: z.string(),
  redirectUrl: z.string().optional(),
  status: kycStatusSchema,
});

export const kycCheckResultSchema = z.object({
  providerReference: z.string(),
  status: kycStatusSchema,
  details: z.record(z.string(), z.unknown()).optional(),
});

export type KycStatus = z.infer<typeof kycStatusSchema>;
export type KycInitiateResult = z.infer<typeof kycInitiateResultSchema>;
export type KycCheckResult = z.infer<typeof kycCheckResultSchema>;

// ── Signature provider ──
export const signatureStatusSchema = z.enum([
  "pending", "sent", "viewed", "signed", "declined", "expired", "cancelled",
]);

export const signatureRequestResultSchema = z.object({
  providerReference: z.string(),
  status: signatureStatusSchema,
  signingUrl: z.string().optional(),
});

export const signatureCheckResultSchema = z.object({
  providerReference: z.string(),
  status: signatureStatusSchema,
  signedAt: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type SignatureStatus = z.infer<typeof signatureStatusSchema>;
export type SignatureRequestResult = z.infer<typeof signatureRequestResultSchema>;
export type SignatureCheckResult = z.infer<typeof signatureCheckResultSchema>;

// ── Payments provider ──
export const paymentStatusSchema = z.enum([
  "pending", "processing", "completed", "failed", "cancelled",
]);

export const paymentOperationResultSchema = z.object({
  providerReference: z.string(),
  status: paymentStatusSchema,
  checkoutUrl: z.string().optional(),
});

export const paymentCheckResultSchema = z.object({
  providerReference: z.string(),
  status: paymentStatusSchema,
  amount: z.object({ cents: z.number().int(), currency: z.string() }).optional(),
  completedAt: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentOperationResult = z.infer<typeof paymentOperationResultSchema>;
export type PaymentCheckResult = z.infer<typeof paymentCheckResultSchema>;

// ── Provider event (webhook interpretation) ──
export const providerEventSchema = z.object({
  provider: z.enum(["email", "storage", "kyc", "signature", "payments"]),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export type ProviderEvent = z.infer<typeof providerEventSchema>;

// ── Provider config ──
export const providerConfigSchema = z.object({
  email: z.enum(["disabled"]).default("disabled"),
  storage: z.enum(["disabled"]).default("disabled"),
  kyc: z.enum(["disabled"]).default("disabled"),
  signature: z.enum(["disabled"]).default("disabled"),
  payments: z.enum(["disabled"]).default("disabled"),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderType = keyof ProviderConfig;
