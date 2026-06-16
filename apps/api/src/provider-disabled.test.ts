import { describe, it, expect } from "vitest";
import {
  DisabledEmailProvider,
  DisabledStorageProvider,
  DisabledKycProvider,
  DisabledSignatureProvider,
  DisabledPaymentsProvider,
} from "./providers/disabled.js";

describe("disabled providers", () => {
  describe("DisabledEmailProvider", () => {
    const p = new DisabledEmailProvider();

    it("has kind 'email'", () => {
      expect(p.kind).toBe("email");
    });

    it("send throws provider_not_configured", async () => {
      try {
        await p.send({ to: "a@b.com", subject: "t", bodyText: "b" });
        expect.unreachable("Expected send to throw");
      } catch (e) {
        const err = e as Error & { code?: string; statusCode?: number };
        expect(err.code).toBe("provider_not_configured");
        expect(err.statusCode).toBe(503);
      }
    });

    it("health returns not_configured", async () => {
      const h = await p.health();
      expect(h.configured).toBe(false);
      expect(h.status).toBe("not_configured");
    });
  });

  describe("DisabledStorageProvider", () => {
    const p = new DisabledStorageProvider();

    it("save throws provider_not_configured", async () => {
      try {
        await p.save("key", Buffer.from("x"), "text/plain");
        expect.unreachable("Expected save to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("getSecureUrl throws provider_not_configured", async () => {
      try {
        await p.getSecureUrl("key");
        expect.unreachable("Expected getSecureUrl to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("health returns not_configured", async () => {
      const h = await p.health();
      expect(h.status).toBe("not_configured");
    });
  });

  describe("DisabledKycProvider", () => {
    const p = new DisabledKycProvider();

    it("initiate throws provider_not_configured", async () => {
      try {
        await p.initiate({ userId: "u1", email: "a@b.com", name: "A" });
        expect.unreachable("Expected initiate to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("checkStatus throws provider_not_configured", async () => {
      try {
        await p.checkStatus("ref");
        expect.unreachable("Expected checkStatus to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("interpretEvent throws provider_not_configured", async () => {
      try {
        await p.interpretEvent({ type: "kyc.completed" });
        expect.unreachable("Expected interpretEvent to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });
  });

  describe("DisabledSignatureProvider", () => {
    const p = new DisabledSignatureProvider();

    it("createRequest throws provider_not_configured", async () => {
      try {
        await p.createRequest({ userId: "u1", email: "a@b.com", documentReference: "d1", documentTitle: "T" });
        expect.unreachable("Expected createRequest to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("health returns not_configured", async () => {
      const h = await p.health();
      expect(h.status).toBe("not_configured");
    });
  });

  describe("DisabledPaymentsProvider", () => {
    const p = new DisabledPaymentsProvider();

    it("createOperation throws provider_not_configured", async () => {
      try {
        await p.createOperation({ userId: "u1", email: "a@b.com", amountCents: 1000, currency: "EUR", concept: "test" });
        expect.unreachable("Expected createOperation to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("cancel throws provider_not_configured", async () => {
      try {
        await p.cancel("ref");
        expect.unreachable("Expected cancel to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("health returns not_configured", async () => {
      const h = await p.health();
      expect(h.status).toBe("not_configured");
    });
  });

  describe("no fake IDs", () => {
    it("DisabledKycProvider.initiate never succeeds with a fake reference", async () => {
      const p = new DisabledKycProvider();
      try {
        await p.initiate({ userId: "u1", email: "a@b.com", name: "A" });
        expect.unreachable("Expected initiate to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });

    it("DisabledPaymentsProvider.createOperation never succeeds with a fake reference", async () => {
      const p = new DisabledPaymentsProvider();
      try {
        await p.createOperation({ userId: "u1", email: "a@b.com", amountCents: 1000, currency: "EUR", concept: "test" });
        expect.unreachable("Expected createOperation to throw");
      } catch (e) {
        expect((e as Error & { code?: string }).code).toBe("provider_not_configured");
      }
    });
  });
});
