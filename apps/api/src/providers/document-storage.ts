/**
 * Private Document Storage — Provider interface and disabled adapter.
 *
 * Honest contract: no physical storage provider is selected yet.
 * The disabled adapter returns an honest "not available" response
 * and logs the intent for audit purposes.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { requireBetterAuthSession, requireActiveAppUser, requireProjectAccess } from '../auth/middleware.js';

// ── Types ──

export interface StoredDocument {
  documentId: string;
  projectSlug: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface DocumentStorageProvider {
  /** List documents available to a user for a project */
  listDocuments(userId: string, projectSlug: string): Promise<StoredDocument[]>;
  /** Generate a download URL or stream */
  getDownloadUrl(userId: string, projectSlug: string, documentId: string): Promise<string | null>;
  /** Health check */
  health(): Promise<{ configured: boolean; status: string }>;
}

// ── Disabled adapter ──

export class DisabledDocumentStorage implements DocumentStorageProvider {
  async listDocuments(_userId: string, _projectSlug: string): Promise<StoredDocument[]> {
    return [];
  }

  async getDownloadUrl(_userId: string, _projectSlug: string, _documentId: string): Promise<null> {
    return null;
  }

  async health() {
    return { configured: false, status: 'disabled' };
  }
}

// ── Factory ──

let _storage: DocumentStorageProvider | null = null;

export function getDocumentStorage(): DocumentStorageProvider {
  if (!_storage) {
    _storage = new DisabledDocumentStorage();
  }
  return _storage;
}

export function setDocumentStorage(provider: DocumentStorageProvider): void {
  _storage = provider;
}

// ── Sanitization ──

const SAFE_SLUG_RE = /^[a-z0-9-]{1,200}$/;
const SAFE_UUID_RE = /^[0-9a-f-]{36}$/;

function sanitizePathComponent(value: string, regex: RegExp): string {
  if (!regex.test(value)) {
    throw Object.assign(new Error('Invalid path component'), { statusCode: 400 });
  }
  return value;
}

// ── Fastify request extensions (populated by auth middleware) ──

interface AuthRequest extends FastifyRequest {
  _authUser?: { userId: string; roles: string[] };
  _reqId?: string;
}

// ── Routes ──

export function registerPrivateDocumentRoutes(
  app: FastifyInstance,
  pool: Pool,
): void {
  const storage = getDocumentStorage();

  const docsAuthChain = [
    requireBetterAuthSession(),
    requireActiveAppUser(pool),
    requireProjectAccess(pool),
  ];

  // GET /api/investor/projects/:slug/documents
  app.get('/api/investor/projects/:slug/documents', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preHandler: docsAuthChain as any,
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const slug = sanitizePathComponent((request.params as { slug: string }).slug, SAFE_SLUG_RE);
    const user = (request as AuthRequest)._authUser!;

    const docs = await storage.listDocuments(user.userId, slug);
    return { data: docs, meta: { storageStatus: (await storage.health()).status } };
  });

  // GET /api/investor/projects/:slug/documents/:documentId/download
  app.get('/api/investor/projects/:slug/documents/:documentId/download', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preHandler: docsAuthChain as any,
  }, async (request: FastifyRequest, _reply: FastifyReply) => {
    const { slug, documentId: rawDocId } = request.params as { slug: string; documentId: string };
    const documentId = sanitizePathComponent(rawDocId, SAFE_UUID_RE);
    const sanitizedSlug = sanitizePathComponent(slug, SAFE_SLUG_RE);
    const user = (request as AuthRequest)._authUser!;

    const url = await storage.getDownloadUrl(user.userId, sanitizedSlug, documentId);
    if (!url) {
      return _reply.status(404).send({
        error: { code: 'document_unavailable', message: 'El documento no está disponible. El almacenamiento definitivo aún no ha sido configurado.' },
      });
    }

    return _reply.redirect(url);
  });

  // Audit hook for document access
  app.addHook('onRequest', async (request: FastifyRequest) => {
    const requestUrl = request.url;
    if (requestUrl.includes('/documents')) {
      const reqId = randomUUID();
      (request as AuthRequest)._reqId = reqId;
      request.log.info({ reqId, path: requestUrl }, 'document access');
    }
  });
}
