/**
 * Centralised provider selection.
 * All providers default to "disabled". Set PROVIDER_* env vars
 * to the name of a registered provider when ready to activate.
 */
import type {
  EmailProvider,
  StorageProvider,
  KycProvider,
  SignatureProvider,
  PaymentsProvider,
} from "./interfaces.js";
import {
  DisabledEmailProvider,
  DisabledStorageProvider,
  DisabledKycProvider,
  DisabledSignatureProvider,
  DisabledPaymentsProvider,
} from "./disabled.js";

export interface ProviderSet {
  email: EmailProvider;
  storage: StorageProvider;
  kyc: KycProvider;
  signature: SignatureProvider;
  payments: PaymentsProvider;
}

function selectProvider<T>(
  envVar: string | undefined,
  defaultProvider: string,
  registry: Record<string, () => T>,
): T {
  const name = (envVar || "").trim() || defaultProvider;
  const factory = registry[name];
  if (!factory) {
    throw new Error(
      `Unknown provider "${name}" for env var. Available: ${Object.keys(registry).join(", ")}.`
    );
  }
  return factory();
}

export function createProviders(overrides?: Partial<ProviderSet>): ProviderSet {
  if (overrides) {
    return {
      email: overrides.email ?? new DisabledEmailProvider(),
      storage: overrides.storage ?? new DisabledStorageProvider(),
      kyc: overrides.kyc ?? new DisabledKycProvider(),
      signature: overrides.signature ?? new DisabledSignatureProvider(),
      payments: overrides.payments ?? new DisabledPaymentsProvider(),
    };
  }

  return {
    email: selectProvider(
      process.env.PROVIDER_EMAIL,
      "disabled",
      { disabled: () => new DisabledEmailProvider() }
    ),
    storage: selectProvider(
      process.env.PROVIDER_STORAGE,
      "disabled",
      { disabled: () => new DisabledStorageProvider() }
    ),
    kyc: selectProvider(
      process.env.PROVIDER_KYC,
      "disabled",
      { disabled: () => new DisabledKycProvider() }
    ),
    signature: selectProvider(
      process.env.PROVIDER_SIGNATURE,
      "disabled",
      { disabled: () => new DisabledSignatureProvider() }
    ),
    payments: selectProvider(
      process.env.PROVIDER_PAYMENTS,
      "disabled",
      { disabled: () => new DisabledPaymentsProvider() }
    ),
  };
}
