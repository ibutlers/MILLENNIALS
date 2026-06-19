import { describe, it, expect } from "vitest";
import { errorResponseSchema } from "./errors.js";
import { userResponseSchema, loginRequestSchema, registerRequestSchema } from "./auth.js";
import { opportunitySummarySchema, opportunityDetailSchema } from "./opportunities.js";
import { providerHealthSchema, kycStatusSchema } from "./providers.js";

describe("shared contracts", () => {
  // ── Errors ──
  describe("errorResponseSchema", () => {
    it("accepts a valid error response", () => {
      const result = errorResponseSchema.safeParse({
        error: { id: "err_abc", code: "not_found", message: "No encontrado." },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing error.id", () => {
      const result = errorResponseSchema.safeParse({
        error: { code: "not_found", message: "No encontrado." },
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-string error.code", () => {
      const result = errorResponseSchema.safeParse({
        error: { id: "err_abc", code: 123, message: "No encontrado." },
      });
      expect(result.success).toBe(false);
    });
  });

  // ── Auth ──
  describe("userResponseSchema", () => {
    const validUser = {
      id: "uuid-123",
      email: "test@example.com",
      name: "Test User",
      roles: ["investor"],
      status: "active",
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    it("accepts a valid user", () => {
      expect(userResponseSchema.safeParse(validUser).success).toBe(true);
    });

    it("rejects missing email", () => {
      const { id, ...rest } = validUser;
      expect(userResponseSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects invalid email", () => {
      expect(
        userResponseSchema.safeParse({ ...validUser, email: "not-an-email" }).success
      ).toBe(false);
    });

    it("rejects non-boolean emailVerified", () => {
      expect(
        userResponseSchema.safeParse({ ...validUser, emailVerified: "yes" }).success
      ).toBe(false);
    });
  });

  describe("loginRequestSchema", () => {
    it("accepts valid login payload", () => {
      expect(
        loginRequestSchema.safeParse({ email: "a@b.com", password: "12345678" }).success
      ).toBe(true);
    });

    it("rejects short password", () => {
      expect(
        loginRequestSchema.safeParse({ email: "a@b.com", password: "1234567" }).success
      ).toBe(false);
    });

    it("rejects extra fields (strict)", () => {
      expect(
        loginRequestSchema.safeParse({
          email: "a@b.com",
          password: "12345678",
          extra: true,
        }).success
      ).toBe(false);
    });
  });

  describe("registerRequestSchema", () => {
    it("accepts valid registration", () => {
      expect(
        registerRequestSchema.safeParse({
          email: "a@b.com",
          password: "12345678",
          name: "Alice",
        }).success
      ).toBe(true);
    });

    it("rejects empty name", () => {
      expect(
        registerRequestSchema.safeParse({
          email: "a@b.com",
          password: "12345678",
          name: "",
        }).success
      ).toBe(false);
    });
  });

  // ── Opportunities ──
  describe("opportunitySummarySchema", () => {
    it("rejects invalid status", () => {
      const opp = {
        slug: "test",
        title: "Test",
        shortDescription: "desc",
        city: "City",
        countryCode: "ES",
        district: null,
        assetType: "residential",
        strategy: "buy_and_hold",
        status: "invalid_status",
        currency: "EUR",
        targetAmount: { cents: 100000, currency: "EUR", formatted: "€1,000" },
        committedAmount: null,
        projectTotalAmount: { cents: 250000, currency: "EUR", formatted: "€2,500" },
        bankFinancingAmount: { cents: 150000, currency: "EUR", formatted: "€1,500" },
        minimumInvestment: { cents: 10000, currency: "EUR", formatted: "€100" },
        estimatedTermMonths: 12,
        targetReturnType: "target_irr",
        targetReturn: { basisPoints: 800, decimal: 8, formatted: "8%" },
        riskLevel: "medium",
        closingDate: null,
        publishedAt: null,
        fundingProgress: 0,
        primaryImage: null,
        disclaimer: "",
      };
      expect(opportunitySummarySchema.safeParse(opp).success).toBe(false);
    });
  });

  // ── Providers ──
  describe("providerHealthSchema", () => {
    it("accepts not_configured health", () => {
      expect(
        providerHealthSchema.safeParse({
          configured: false,
          status: "not_configured",
          message: "Email provider not configured.",
        }).success
      ).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(
        providerHealthSchema.safeParse({
          configured: false,
          status: "fake_status",
        }).success
      ).toBe(false);
    });
  });

  describe("kycStatusSchema", () => {
    it("accepts all valid statuses", () => {
      for (const s of ["not_started", "pending", "in_review", "approved", "rejected", "expired"]) {
        expect(kycStatusSchema.safeParse(s).success).toBe(true);
      }
    });

    it("rejects unknown status", () => {
      expect(kycStatusSchema.safeParse("verified").success).toBe(false);
    });
  });
});
