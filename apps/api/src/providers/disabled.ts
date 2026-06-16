/**
 * Disabled provider adapters.
 * 
 * Behaviour contract:
 * - Never simulate success.
 * - Always return a typed provider_not_configured error.
 * - Never generate fake IDs, URLs, or states.
 * - Never expose webhook routes in production.
 * - Never contain SDKs or real credentials.
 */

import type {
  EmailProvider,
  EmailSendParams,
  StorageProvider,
  StorageUploadResult,
  StorageMetadata,
  KycProvider,
  KycInitiateParams,
  KycInitiateResult,
  KycCheckResult,
  SignatureProvider,
  SignatureRequestParams,
  SignatureRequestResult,
  SignatureCheckResult,
  PaymentsProvider,
  PaymentOperationParams,
  PaymentOperationResult,
  PaymentCheckResult,
} from "./interfaces.js";

// ── Error factory ──
function notConfigured(provider: string): Error {
  const err = new Error(`El proveedor ${provider} no está configurado.`);
  (err as Error & { code: string; statusCode: number }).code = "provider_not_configured";
  (err as Error & { statusCode: number }).statusCode = 503;
  return err;
}

function healthNotConfigured(provider: string): { configured: boolean; status: string; message: string } {
  return {
    configured: false,
    status: "not_configured",
    message: `${provider} provider not configured.`,
  };
}

// ── DisabledEmailProvider ──
export class DisabledEmailProvider implements EmailProvider {
  readonly kind = "email" as const;

  async send(_params: EmailSendParams): Promise<void> {
    throw notConfigured("email");
  }

  async health(): Promise<{ configured: boolean; status: string; message?: string }> {
    return healthNotConfigured("email");
  }
}

// ── DisabledStorageProvider ──
export class DisabledStorageProvider implements StorageProvider {
  readonly kind = "storage" as const;

  async save(_key: string, _body: Buffer, _contentType: string): Promise<StorageUploadResult> {
    throw notConfigured("storage");
  }

  async getSecureUrl(_key: string, _expiresInSeconds?: number): Promise<string> {
    throw notConfigured("storage");
  }

  async delete(_key: string): Promise<void> {
    throw notConfigured("storage");
  }

  async metadata(_key: string): Promise<StorageMetadata | null> {
    throw notConfigured("storage");
  }

  async health(): Promise<{ configured: boolean; status: string; message?: string }> {
    return healthNotConfigured("storage");
  }
}

// ── DisabledKycProvider ──
export class DisabledKycProvider implements KycProvider {
  readonly kind = "kyc" as const;

  async initiate(_params: KycInitiateParams): Promise<KycInitiateResult> {
    throw notConfigured("kyc");
  }

  async checkStatus(_providerReference: string): Promise<KycCheckResult> {
    throw notConfigured("kyc");
  }

  async interpretEvent(_payload: Record<string, unknown>): Promise<KycCheckResult> {
    throw notConfigured("kyc");
  }

  async health(): Promise<{ configured: boolean; status: string; message?: string }> {
    return healthNotConfigured("kyc");
  }
}

// ── DisabledSignatureProvider ──
export class DisabledSignatureProvider implements SignatureProvider {
  readonly kind = "signature" as const;

  async createRequest(_params: SignatureRequestParams): Promise<SignatureRequestResult> {
    throw notConfigured("signature");
  }

  async checkStatus(_providerReference: string): Promise<SignatureCheckResult> {
    throw notConfigured("signature");
  }

  async interpretEvent(_payload: Record<string, unknown>): Promise<SignatureCheckResult> {
    throw notConfigured("signature");
  }

  async health(): Promise<{ configured: boolean; status: string; message?: string }> {
    return healthNotConfigured("signature");
  }
}

// ── DisabledPaymentsProvider ──
export class DisabledPaymentsProvider implements PaymentsProvider {
  readonly kind = "payments" as const;

  async createOperation(_params: PaymentOperationParams): Promise<PaymentOperationResult> {
    throw notConfigured("payments");
  }

  async checkStatus(_providerReference: string): Promise<PaymentCheckResult> {
    throw notConfigured("payments");
  }

  async cancel(_providerReference: string): Promise<void> {
    throw notConfigured("payments");
  }

  async interpretEvent(_payload: Record<string, unknown>): Promise<PaymentCheckResult> {
    throw notConfigured("payments");
  }

  async health(): Promise<{ configured: boolean; status: string; message?: string }> {
    return healthNotConfigured("payments");
  }
}
