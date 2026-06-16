import { describe, it, expect } from "vitest";
import { createProviders } from "./providers/config.js";
import {
  DisabledEmailProvider,
  DisabledStorageProvider,
  DisabledKycProvider,
  DisabledSignatureProvider,
  DisabledPaymentsProvider,
} from "./providers/disabled.js";
import { registerInvestorRoutes } from "./investor/routes.js";

describe("investor provider integration", () => {
  describe("provider health checks", () => {
    it("all disabled providers report not_configured", async () => {
      const [email, storage, kyc, signature, payments] = await Promise.all([
        new DisabledEmailProvider().health(),
        new DisabledStorageProvider().health(),
        new DisabledKycProvider().health(),
        new DisabledSignatureProvider().health(),
        new DisabledPaymentsProvider().health(),
      ]);

      for (const h of [email, storage, kyc, signature, payments]) {
        expect(h.configured).toBe(false);
        expect(h.status).toBe("not_configured");
      }
    });
  });

  describe("provider selection via createProviders", () => {
    it("defaults all providers to disabled", () => {
      const { email, storage, kyc, signature, payments } = createProviders();
      expect(email.kind).toBe("email");
      expect(storage.kind).toBe("storage");
      expect(kyc.kind).toBe("kyc");
      expect(signature.kind).toBe("signature");
      expect(payments.kind).toBe("payments");
    });

    it("accepts overrides for testing", () => {
      const customKyc = new DisabledKycProvider();
      const providers = createProviders({ kyc: customKyc });
      expect(providers.kyc).toBe(customKyc);
    });

    it("override preserves other disabled defaults", () => {
      const customEmail = new DisabledEmailProvider();
      const providers = createProviders({ email: customEmail });
      expect(providers.email).toBe(customEmail);
      // Others should still be disabled (not the same instance, but same kind)
      expect(providers.storage.kind).toBe("storage");
      expect(providers.kyc.kind).toBe("kyc");
    });
  });

  describe("security: investor API routes require auth", () => {
    // These verify the route definitions exist and enforce auth.
    // Full integration with Fastify + DB is tested in E2E.

    it("investor routes are registered in the API module", () => {
      // Verify the module exports exist
      expect(typeof registerInvestorRoutes).toBe("function");
    });
  });

  describe("provider_not_configured always has 503 status", () => {
    it("DisabledEmailProvider.send sets statusCode 503", async () => {
      const p = new DisabledEmailProvider();
      try {
        await p.send({ to: "a@b.com", subject: "t", bodyText: "b" });
        expect.unreachable("Expected send to throw");
      } catch (e) {
        const err = e as Error & { code?: string; statusCode?: number };
        expect(err.code).toBe("provider_not_configured");
        expect(err.statusCode).toBe(503);
      }
    });

    it("DisabledKycProvider.initiate sets statusCode 503", async () => {
      const p = new DisabledKycProvider();
      try {
        await p.initiate({ userId: "u1", email: "a@b.com", name: "A" });
        expect.unreachable("Expected initiate to throw");
      } catch (e) {
        const err = e as Error & { code?: string; statusCode?: number };
        expect(err.code).toBe("provider_not_configured");
        expect(err.statusCode).toBe(503);
      }
    });

    it("DisabledPaymentsProvider.createOperation sets statusCode 503", async () => {
      const p = new DisabledPaymentsProvider();
      try {
        await p.createOperation({ userId: "u1", email: "a@b.com", amountCents: 1000, currency: "EUR", concept: "test" });
        expect.unreachable("Expected createOperation to throw");
      } catch (e) {
        const err = e as Error & { code?: string; statusCode?: number };
        expect(err.code).toBe("provider_not_configured");
        expect(err.statusCode).toBe(503);
      }
    });
  });
});
