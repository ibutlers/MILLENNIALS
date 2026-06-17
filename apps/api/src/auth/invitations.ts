/**
 * Invitation Repository
 *
 * Manages access_invitations: creation, validation, consumption, revocation.
 * Tokens are 256-bit random values stored as SHA-256 hashes.
 * Comparison uses timing-safe equality.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccessInvitation {
  id: string;
  publicReference: string;
  emailNormalized: string;
  tokenHash: string;
  coinvestLeadId: string | null;
  betterAuthUserId: string | null;
  appUserId: string | null;
  intendedRole: 'investor' | 'staff' | 'admin';
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'failed';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  resendCount: number;
  lastSentAt: string | null;
  createdBy: string | null;
}

export interface CreateInvitationInput {
  emailNormalized: string;
  coinvestLeadId?: string;
  intendedRole?: 'investor' | 'staff' | 'admin';
  createdBy?: string;
  ttlHours?: number;
}

export type ValidateInvitationResult =
  | { valid: true; invitation: AccessInvitation }
  | { valid: false; reason: 'not_found' | 'expired' | 'revoked' | 'already_accepted' | 'email_mismatch' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOKEN_BYTES = 32; // 256 bits

/** Generate a cryptographically random token (256 bits). */
export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Hash a token with SHA-256 for storage. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Timing-safe comparison of two strings. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Generate a public reference: INV-YYYYMMDD-XXXXXX */
function generatePublicReference(): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = now.getUTCDate().toString().padStart(2, '0');
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `INV-${y}${m}${d}-${random}`;
}

function rowToInvitation(row: Record<string, unknown>): AccessInvitation {
  return {
    id: row.id as string,
    publicReference: row.public_reference as string,
    emailNormalized: row.email_normalized as string,
    tokenHash: row.token_hash as string,
    coinvestLeadId: (row.coinvest_lead_id as string) || null,
    betterAuthUserId: (row.better_auth_user_id as string) || null,
    appUserId: (row.app_user_id as string) || null,
    intendedRole: (row.intended_role as 'investor' | 'staff' | 'admin') || 'investor',
    status: row.status as AccessInvitation['status'],
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at as string).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : null,
    revokedBy: (row.revoked_by as string) || null,
    revocationReason: (row.revocation_reason as string) || null,
    resendCount: row.resend_count as number,
    lastSentAt: row.last_sent_at ? new Date(row.last_sent_at as string).toISOString() : null,
    createdBy: (row.created_by as string) || null,
  };
}

// ---------------------------------------------------------------------------
// InvitationRepository
// ---------------------------------------------------------------------------

export class InvitationRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new invitation. Returns the raw token (only time it's exposed)
   * and the invitation record. Caller must send the token via email.
   */
  async create(input: CreateInvitationInput): Promise<{ invitation: AccessInvitation; token: string }> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check for existing active invitation
      const existing = await client.query(
        `SELECT id, status FROM access_invitations
         WHERE email_normalized = $1 AND status = 'pending'`,
        [input.emailNormalized],
      );
      if (existing.rows.length > 0) {
        throw Object.assign(
          new Error('Ya existe una invitación activa para este email.'),
          { code: 'duplicate_invitation', statusCode: 409 },
        );
      }

      // Check for existing active user
      const existingUser = await client.query(
        `SELECT id FROM app_users
         WHERE email_normalized = $1 AND status = 'active'`,
        [input.emailNormalized],
      );
      if (existingUser.rows.length > 0) {
        throw Object.assign(
          new Error('Ya existe un usuario activo con este email.'),
          { code: 'active_user_exists', statusCode: 409 },
        );
      }

      const token = generateInvitationToken();
      const tokenHash = hashToken(token);
      const publicReference = generatePublicReference();
      const ttlHours = input.ttlHours ?? 48;

      const result = await client.query(
        `INSERT INTO access_invitations
         (public_reference, email_normalized, token_hash, coinvest_lead_id,
          intended_role, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' hours')::interval)
         RETURNING *`,
        [
          publicReference,
          input.emailNormalized,
          tokenHash,
          input.coinvestLeadId || null,
          input.intendedRole || 'investor',
          input.createdBy || null,
          ttlHours.toString(),
        ],
      );

      const invitation = rowToInvitation(result.rows[0]);

      // Audit
      await client.query(
        `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result, metadata)
         VALUES ($1, 'invitation_created', NULL, 'access_invitation', $2, 'success', $3)`,
        [
          input.createdBy || null,
          invitation.id,
          JSON.stringify({ email: input.emailNormalized, intended_role: input.intendedRole }),
        ],
      );

      await client.query('COMMIT');
      return { invitation, token };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validate an invitation token (timing-safe comparison).
   * Returns the invitation if valid, or a reason why it's not.
   */
  async validateToken(token: string, email: string): Promise<ValidateInvitationResult> {
    const tokenHash = hashToken(token);
    const emailNormalized = email.toLowerCase().trim();

    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the invitation row to prevent concurrent consumption
      const result = await client.query(
        `SELECT * FROM access_invitations
         WHERE email_normalized = $1
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [emailNormalized],
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'not_found' };
      }

      const row = result.rows[0];
      const invitation = rowToInvitation(row);

      // Timing-safe token comparison
      if (!safeCompare(tokenHash, row.token_hash as string)) {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'not_found' };
      }

      // Check status
      if (invitation.status === 'revoked') {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'revoked' };
      }

      if (invitation.status === 'accepted') {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'already_accepted' };
      }

      // Check expiration
      if (new Date(invitation.expiresAt) < new Date()) {
        // Mark as expired
        await client.query(
          `UPDATE access_invitations SET status = 'expired' WHERE id = $1`,
          [invitation.id],
        );
        await client.query('COMMIT');
        return { valid: false, reason: 'expired' };
      }

      if (invitation.status !== 'pending') {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'not_found' };
      }

      // Verify email matches
      if (invitation.emailNormalized !== emailNormalized) {
        await client.query('ROLLBACK');
        return { valid: false, reason: 'email_mismatch' };
      }

      await client.query('COMMIT');
      return { valid: true, invitation };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Mark an invitation as accepted (idempotent).
   * Called after Better Auth user is created and linked.
   */
  async markAccepted(invitationId: string, betterAuthUserId: string, appUserId: string): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE access_invitations
         SET status = 'accepted',
             accepted_at = now(),
             better_auth_user_id = $1,
             app_user_id = $2
         WHERE id = $3 AND status = 'pending'
         RETURNING id`,
        [betterAuthUserId, appUserId, invitationId],
      );

      if (result.rows.length > 0) {
        await client.query(
          `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result)
           VALUES ($1, 'invitation_accepted', $2, 'access_invitation', $3, 'success')`,
          [appUserId, appUserId, invitationId],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List invitations (for staff/admins).
   */
  async list(options: { status?: string; email?: string; limit?: number; offset?: number } = {}): Promise<{
    invitations: AccessInvitation[];
    total: number;
  }> {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = options.offset ?? 0;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIdx = 0;

    if (options.status) {
      paramIdx++;
      whereClause += ` AND status = $${paramIdx}`;
      params.push(options.status);
    }

    if (options.email) {
      paramIdx++;
      whereClause += ` AND email_normalized = $${paramIdx}`;
      params.push(options.email.toLowerCase().trim());
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM access_invitations ${whereClause}`,
      params,
    );
    const total = countResult.rows[0].total as number;

    const result = await this.pool.query(
      `SELECT * FROM access_invitations ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      [...params, limit, offset],
    );

    return {
      invitations: result.rows.map(rowToInvitation),
      total,
    };
  }

  /**
   * Revoke an invitation.
   */
  async revoke(invitationId: string, revokedBy: string, reason?: string): Promise<AccessInvitation | null> {
    const result = await this.pool.query(
      `UPDATE access_invitations
       SET status = 'revoked', revoked_at = now(), revoked_by = $1, revocation_reason = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [revokedBy, reason || null, invitationId],
    );
    if (result.rows.length === 0) return null;
    return rowToInvitation(result.rows[0]);
  }

  /**
   * Find an invitation by its public reference.
   */
  async findByReference(publicReference: string): Promise<AccessInvitation | null> {
    const result = await this.pool.query(
      `SELECT * FROM access_invitations WHERE public_reference = $1`,
      [publicReference],
    );
    if (result.rows.length === 0) return null;
    return rowToInvitation(result.rows[0]);
  }
}
