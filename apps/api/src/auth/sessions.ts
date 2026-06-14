import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically secure session token (32 bytes, base64url-encoded).
 * This raw token is sent to the client as a cookie value.
 */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a session token using SHA-256 for database storage.
 * Raw tokens are never persisted — only their hashes.
 *
 * @throws {TypeError} if token is null, undefined, or empty
 */
export function hashToken(token: string): string {
  if (token == null || typeof token !== 'string' || token.length === 0) {
    throw new TypeError('token must be a non-empty string');
  }
  return createHash('sha256').update(token).digest('hex');
}
