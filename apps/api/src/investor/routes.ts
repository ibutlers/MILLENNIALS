import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { AuthRepository } from "../auth/repository.js";
import { hashToken } from "../auth/sessions.js";
import { createProviders, type ProviderSet } from "../providers/index.js";

const SESSION_COOKIE = "realstate_sid";

function errorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(code: string, message: string) {
  return { error: { id: errorId(), code, message } };
}

async function getUserIdFromSession(
  request: FastifyRequest,
  repo: AuthRepository
): Promise<string | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await repo.findSessionByTokenHash(tokenHash);
  if (!session || session.revokedAt || new Date(session.expiresAt) < new Date())
    return null;
  if (session.userStatus !== "active") return null;
  return session.userId;
}

export interface InvestorRoutesOptions {
  pool: Pool;
  authEnabled: boolean;
  providers?: ProviderSet;
}

export function registerInvestorRoutes(
  app: FastifyInstance,
  options: InvestorRoutesOptions
): void {
  const { pool, authEnabled } = options;
  const providers = options.providers ?? createProviders();
  const repo = new AuthRepository(pool);

  // Auth guard
  const requireAuth = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<string | null> => {
    if (!authEnabled) {
      void reply
        .status(503)
        .send(
          publicError(
            "auth_disabled",
            "La autenticación todavía no está habilitada."
          )
        );
      return null;
    }
    const userId = await getUserIdFromSession(request, repo);
    if (!userId) {
      void reply
        .status(401)
        .send(
          publicError("unauthorized", "Autenticación requerida.")
        );
      return null;
    }
    return userId;
  };

  // ── GET /me (investor profile) ──
  app.get("/api/v1/investor/me", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;

    const user = await repo.findUserById(userId);
    if (!user || user.status === "disabled") {
      return reply
        .status(401)
        .send(publicError("unauthorized", "Autenticación requerida."));
    }

    const roles = await repo.getUserRoles(userId);

    return {
      data: {
        id: user.id,
        email: user.email,
        name: "Usuario",
        roles,
        status: user.status,
        emailVerified: !!user.emailVerifiedAt,
        createdAt: user.createdAt,
      },
    };
  });

  // ── GET /portfolio — always empty (no investment flow yet) ──
  app.get("/api/v1/investor/portfolio", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;

    // Honest empty: no investment tracking exists
    return {
      data: {
        investments: [],
        summary: {
          totalCommittedCents: 0,
          totalContributedCents: 0,
          activeInvestments: 0,
        },
        disclaimer:
          "No hay funcionalidad de inversión activa. Los datos mostrados son reales: aún no tienes inversiones.",
      },
    };
  });

  // ── GET /documents — always empty (no document generation yet) ──
  app.get("/api/v1/investor/documents", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;

    return {
      data: {
        documents: [],
        disclaimer:
          "No se generan documentos simulados. Cuando realices tu primera inversión, aparecerán aquí los contratos y certificados reales.",
      },
    };
  });

  // ── GET /verification — KYC disabled ──
  app.get("/api/v1/investor/verification", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;

    try {
      const health = await providers.kyc.health();
      return {
        data: {
          status: "not_configured",
          providerStatus: health,
          disclaimer:
            "El proveedor de verificación de identidad (KYC) no está configurado. No se simula un estado verificado.",
        },
      };
    } catch {
      return {
        data: {
          status: "not_configured",
          providerStatus: {
            configured: false,
            status: "not_configured",
            message: "KYC provider not available.",
          },
          disclaimer:
            "El proveedor de verificación de identidad (KYC) no está configurado.",
        },
      };
    }
  });

  // ── GET /providers-health — dashboard for admins ──
  app.get("/api/v1/investor/providers-health", async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;

    const [email, storage, kyc, signature, payments] = await Promise.all([
      providers.email.health().catch(() => ({
        configured: false,
        status: "error",
        message: "health check failed",
      })),
      providers.storage.health().catch(() => ({
        configured: false,
        status: "error",
        message: "health check failed",
      })),
      providers.kyc.health().catch(() => ({
        configured: false,
        status: "error",
        message: "health check failed",
      })),
      providers.signature.health().catch(() => ({
        configured: false,
        status: "error",
        message: "health check failed",
      })),
      providers.payments.health().catch(() => ({
        configured: false,
        status: "error",
        message: "health check failed",
      })),
    ]);

    return { data: { email, storage, kyc, signature, payments } };
  });
}
