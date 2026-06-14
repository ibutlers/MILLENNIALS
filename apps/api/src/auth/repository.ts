import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  publicReference: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  userStatus: string;
}

export interface CreateUserInput {
  email: string;
  emailNormalized: string;
  passwordHash: string;
  name: string;
}

export interface CreateUserResult {
  id: string;
  publicReference: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgentHash?: string;
}

export interface CreateSessionResult {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEventInput {
  eventType: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a PostgreSQL row to a User object, converting timestamps to ISO strings. */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    publicReference: row.public_reference as string,
    email: row.email as string,
    emailNormalized: row.email_normalized as string,
    passwordHash: row.password_hash as string,
    status: row.status as string,
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string).toISOString() : null,
  };
}

/** Map a PostgreSQL row to a Session object, converting timestamps to ISO strings. */
function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : null,
    userStatus: row.user_status as string,
  };
}

/** Generate a public reference string in the format USR-YYYYMMDD-XXXXX. */
function generatePublicReference(): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = now.getUTCDate().toString().padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex'); // 3 bytes → 6 hex chars
  return `USR-${y}${m}${d}-${random.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// AuthRepository
// ---------------------------------------------------------------------------

export class AuthRepository {
  public pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ---- Core user operations -----------------------------------------------

  async findUserByEmail(emailNormalized: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, public_reference, email, email_normalized, password_hash, status,
              email_verified_at, created_at, last_login_at
       FROM users
       WHERE email_normalized = $1`,
      [emailNormalized],
    );
    if (result.rows.length === 0) return null;
    return rowToUser(result.rows[0]);
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query(
      `SELECT id, public_reference, email, email_normalized, password_hash, status,
              email_verified_at, created_at, last_login_at
       FROM users
       WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return rowToUser(result.rows[0]);
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const publicReference = generatePublicReference();

      const userResult = await client.query(
        `INSERT INTO users (public_reference, email, email_normalized, password_hash, name, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id, public_reference, email, status, created_at`,
        [publicReference, input.email, input.emailNormalized, input.passwordHash, input.name],
      );

      const user = userResult.rows[0];

      // Assign default 'investor' role
      await client.query(
        `INSERT INTO user_roles (user_id, role)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [user.id, 'investor'],
      );

      await client.query('COMMIT');

      return {
        id: user.id as string,
        publicReference: user.public_reference as string,
        email: user.email as string,
        status: user.status as string,
        createdAt: new Date(user.created_at as string).toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET email_verified_at = now(), status = 'active' WHERE id = $1`,
      [userId],
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET last_login_at = now() WHERE id = $1`,
      [userId],
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [userId, passwordHash],
    );
  }

  async disableUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET status = 'disabled' WHERE id = $1`,
      [userId],
    );
  }

  // ---- Roles --------------------------------------------------------------

  async getUserRoles(userId: string): Promise<string[]> {
    const result = await this.pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => r.role as string);
  }

  async addUserRole(userId: string, role: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, role],
    );
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM user_roles WHERE user_id = $1 AND role = $2`,
      [userId, role],
    );
  }

  // ---- Sessions -----------------------------------------------------------

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const result = await this.pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, expires_at`,
      [input.userId, input.tokenHash, input.expiresAt.toISOString(), input.userAgentHash ?? null],
    );
    const row = result.rows[0];
    return {
      id: row.id as string,
      createdAt: new Date(row.created_at as string).toISOString(),
      expiresAt: new Date(row.expires_at as string).toISOString(),
    };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const result = await this.pool.query(
      `SELECT sessions.*, users.status AS user_status
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1`,
      [tokenHash],
    );
    if (result.rows.length === 0) return null;
    return rowToSession(result.rows[0]);
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET last_seen_at = now() WHERE id = $1`,
      [sessionId],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now() WHERE id = $1`,
      [sessionId],
    );
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async listUserSessions(
    userId: string,
  ): Promise<
    Array<{
      id: string;
      createdAt: string;
      expiresAt: string;
      lastSeenAt: string | null;
      revokedAt: string | null;
      isCurrent: boolean;
    }>
  > {
    const result = await this.pool.query(
      `SELECT id, created_at, expires_at, last_seen_at, revoked_at
       FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      createdAt: new Date(r.created_at as string).toISOString(),
      expiresAt: new Date(r.expires_at as string).toISOString(),
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at as string).toISOString() : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : null,
      isCurrent: false, // set by caller who knows the current session id
    }));
  }

  async countUserSessions(userId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    return result.rows[0].count as number;
  }

  // ---- Verification / Password Reset Tokens -------------------------------

  async createVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete any existing unconsumed verification tokens for this user
      await client.query(
        `DELETE FROM verification_tokens
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId],
      );

      // Insert the new token
      await client.query(
        `INSERT INTO verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt.toISOString()],
      );

      await client.query('COMMIT');
      return tokenHash;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async consumeVerificationToken(
    tokenHash: string,
  ): Promise<{ userId: string } | null> {
    const result = await this.pool.query(
      `UPDATE verification_tokens
       SET consumed_at = now()
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],
    );
    if (result.rows.length === 0) return null;
    return { userId: result.rows[0].user_id as string };
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete any existing unconsumed password reset tokens for this user
      await client.query(
        `DELETE FROM password_reset_tokens
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId],
      );

      // Insert the new token
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt.toISOString()],
      );

      await client.query('COMMIT');
      return tokenHash;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async consumePasswordResetToken(
    tokenHash: string,
  ): Promise<{ userId: string } | null> {
    const result = await this.pool.query(
      `UPDATE password_reset_tokens
       SET consumed_at = now()
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [tokenHash],
    );
    if (result.rows.length === 0) return null;
    return { userId: result.rows[0].user_id as string };
  }

  // ---- Audit --------------------------------------------------------------

  async recordAuditEvent(input: AuditEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (event_type, user_id, session_id, metadata)
       VALUES ($1, $2, $3, $4)`,
      [input.eventType, input.userId ?? null, input.sessionId ?? null, input.metadata ? JSON.stringify(input.metadata) : null],
    );
  }
}
