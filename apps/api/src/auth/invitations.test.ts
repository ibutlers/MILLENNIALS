import { describe, expect, it, vi } from 'vitest';
import { InvitationRepository, hashToken } from './invitations.js';

function makeInvitationRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return {
    id: '00000000-0000-4000-8000-000000000001',
    public_reference: 'INV-TEST-000001',
    email_normalized: 'admin@example.test',
    token_hash: hashToken('valid-token'),
    coinvest_lead_id: null,
    better_auth_user_id: null,
    app_user_id: null,
    intended_role: 'admin',
    status: 'pending',
    created_at: now,
    expires_at: expires,
    accepted_at: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    resend_count: 0,
    last_sent_at: null,
    created_by: null,
    ...overrides,
  };
}

function makeRepo(row: Record<string, unknown> | null) {
  const query = vi.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('FROM access_invitations')) return { rows: row ? [row] : [] };
    if (sql.includes('UPDATE access_invitations SET status')) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) };
  return { repo: new InvitationRepository(pool as never), client };
}

describe('InvitationRepository.validateTokenForActivation', () => {
  it('validates a pending invitation by token hash without requiring email first', async () => {
    const { repo } = makeRepo(makeInvitationRow());

    const result = await repo.validateTokenForActivation('valid-token');

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.invitation.emailNormalized).toBe('admin@example.test');
      expect(result.invitation.intendedRole).toBe('admin');
    }
  });

  it('rejects an unknown activation token without exposing token material', async () => {
    const { repo } = makeRepo(null);

    const result = await repo.validateTokenForActivation('unknown-token');

    expect(result).toEqual({ valid: false, reason: 'not_found' });
  });
});
