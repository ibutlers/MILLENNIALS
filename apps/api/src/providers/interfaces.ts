/**
 * Provider interfaces — typed ports for external integrations.
 * Each interface defines ONLY the operations the current product needs.
 * All implementations go through the provider config to select active/disabled.
 */

// ── Email ──
export interface EmailSendParams {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export interface EmailProvider {
  readonly kind: "email";
  send(params: EmailSendParams): Promise<void>;
  health(): Promise<{ configured: boolean; status: string; message?: string }>;
}

// ── Storage ──
export interface StorageUploadResult {
  key: string;
  url: string;
}

export interface StorageMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: string;
}

export interface StorageProvider {
  readonly kind: "storage";
  save(key: string, body: Buffer, contentType: string): Promise<StorageUploadResult>;
  getSecureUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  metadata(key: string): Promise<StorageMetadata | null>;
  health(): Promise<{ configured: boolean; status: string; message?: string }>;
}

// ── KYC ──
export type KycStatus = "not_started" | "pending" | "in_review" | "approved" | "rejected" | "expired";

export interface KycInitiateParams {
  userId: string;
  email: string;
  name: string;
}

export interface KycInitiateResult {
  providerReference: string;
  redirectUrl?: string;
  status: KycStatus;
}

export interface KycCheckResult {
  providerReference: string;
  status: KycStatus;
  details?: Record<string, unknown>;
}

export interface KycProvider {
  readonly kind: "kyc";
  initiate(params: KycInitiateParams): Promise<KycInitiateResult>;
  checkStatus(providerReference: string): Promise<KycCheckResult>;
  interpretEvent(payload: Record<string, unknown>): Promise<KycCheckResult>;
  health(): Promise<{ configured: boolean; status: string; message?: string }>;
}

// ── Signature ──
export type SignatureStatus = "pending" | "sent" | "viewed" | "signed" | "declined" | "expired" | "cancelled";

export interface SignatureRequestParams {
  userId: string;
  email: string;
  documentReference: string;
  documentTitle: string;
}

export interface SignatureRequestResult {
  providerReference: string;
  status: SignatureStatus;
  signingUrl?: string;
}

export interface SignatureCheckResult {
  providerReference: string;
  status: SignatureStatus;
  signedAt: string | null;
  details?: Record<string, unknown>;
}

export interface SignatureProvider {
  readonly kind: "signature";
  createRequest(params: SignatureRequestParams): Promise<SignatureRequestResult>;
  checkStatus(providerReference: string): Promise<SignatureCheckResult>;
  interpretEvent(payload: Record<string, unknown>): Promise<SignatureCheckResult>;
  health(): Promise<{ configured: boolean; status: string; message?: string }>;
}

// ── Payments ──
export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PaymentOperationParams {
  userId: string;
  email: string;
  amountCents: number;
  currency: string;
  concept: string;
  opportunitySlug?: string;
}

export interface PaymentOperationResult {
  providerReference: string;
  status: PaymentStatus;
  checkoutUrl?: string;
}

export interface PaymentCheckResult {
  providerReference: string;
  status: PaymentStatus;
  amount?: { cents: number; currency: string };
  completedAt: string | null;
  details?: Record<string, unknown>;
}

export interface PaymentsProvider {
  readonly kind: "payments";
  createOperation(params: PaymentOperationParams): Promise<PaymentOperationResult>;
  checkStatus(providerReference: string): Promise<PaymentCheckResult>;
  cancel(providerReference: string): Promise<void>;
  interpretEvent(payload: Record<string, unknown>): Promise<PaymentCheckResult>;
  health(): Promise<{ configured: boolean; status: string; message?: string }>;
}
