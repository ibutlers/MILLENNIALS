import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from './auth/repository.js';

describe('incremental migrations 0002/0003', () => {
  const m2 = readFileSync(resolve(__dirname, 'db/migrations/0002_add_lead_columns.sql'), 'utf8');
  const m3 = readFileSync(resolve(__dirname, 'db/migrations/0003_align_auth_schema.sql'), 'utf8');

  it('keeps 0002 dedicated to lead contract columns and deterministic', () => {
    expect(m2).toContain('ALTER TABLE leads');
    expect(m2).not.toMatch(/IF NOT EXISTS/i);
    expect(m2).toContain('ADD COLUMN phone                  text');
    expect(m2).toContain('ADD COLUMN privacy_accepted_at    timestamptz');
    expect(m2).not.toMatch(/sessions|email_verification_tokens|password_reset_tokens/i);
  });

  it('aligns sessions to hashed user-agent and last_seen_at without keeping full user agent', () => {
    expect(m3).toContain('ALTER TABLE sessions RENAME COLUMN user_agent TO user_agent_hash');
    expect(m3).toContain('ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz');
    expect(m3).toContain('CREATE INDEX sessions_user_active_idx');
    expect(m3).not.toMatch(/ADD COLUMN IF NOT EXISTS/i);
  });

  it('renames token columns to hashes and adds single-use consumption timestamps', () => {
    expect(m3).toContain('ALTER TABLE email_verification_tokens RENAME COLUMN token TO token_hash');
    expect(m3).toContain('ALTER TABLE email_verification_tokens ADD COLUMN consumed_at timestamptz');
    expect(m3).toContain('ALTER TABLE password_reset_tokens RENAME COLUMN token TO token_hash');
    expect(m3).toContain('ALTER TABLE password_reset_tokens RENAME COLUMN used_at TO consumed_at');
    expect(m3).toContain('WHERE consumed_at IS NULL');
  });
});

describe('AuthRepository audit persistence', () => {
  it('records session audit events through the generic entity columns', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const repo = new AuthRepository({ query } as never);

    await repo.recordAuditEvent({
      eventType: 'session_revoked',
      userId: '00000000-0000-0000-0000-000000000001',
      sessionId: '00000000-0000-0000-0000-000000000002',
      metadata: { reason: 'logout' },
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_events (event_type, user_id, entity_type, entity_id, entity_reference, summary, metadata)'),
      [
        'session_revoked',
        '00000000-0000-0000-0000-000000000001',
        'session',
        '00000000-0000-0000-0000-000000000002',
        null,
        'session revoked',
        JSON.stringify({ reason: 'logout' }),
      ],
    );
  });
});
