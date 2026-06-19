import { describe, expect, it, vi } from 'vitest';
import { convertLeadToInvestor, upsertProjectCapitalAssignment } from './lead-workflow.js';

function makeClient(rowsByQuery: Array<Record<string, unknown>[]>) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const rows = rowsByQuery.shift() ?? [];
      return { rows, rowCount: rows.length };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { pool, client, calls };
}

describe('lead workflow', () => {
  it('marks a converted lead and activates an existing app user for the same email', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'lead-1', public_reference: 'RS-1', email: 'USER@EXAMPLE.COM', first_name: 'User', last_name: 'Example' }],
      [{ id: 'app-1', status: 'pending_email', role: 'investor' }],
      [{ id: 'app-1', status: 'active', role: 'investor' }],
      [{ id: 'lead-1', public_reference: 'RS-1', status: 'converted', assigned_user_id: 'app-1' }],
      [],
      [],
    ]);

    const result = await convertLeadToInvestor(pool as never, { reference: 'RS-1', actorId: 'admin-1' });

    expect(result.mode).toBe('activated_existing_user');
    expect(result.appUserId).toBe('app-1');
    expect(calls.some((c) => /UPDATE app_users/i.test(c.sql) && /status='active'/i.test(c.sql))).toBe(true);
    expect(calls.some((c) => /UPDATE leads/i.test(c.sql) && /status='converted'/i.test(c.sql))).toBe(true);
  });

  it('creates a pending investor user when converting a lead without a Better Auth/app user yet', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'lead-1', public_reference: 'RS-1', email: 'new@example.com', first_name: 'New', last_name: 'Lead' }],
      [],
      [],
      [{ id: 'app-1', status: 'pending_email', role: 'investor' }],
      [{ id: 'lead-1', public_reference: 'RS-1', status: 'converted', assigned_user_id: 'app-1' }],
      [],
      [],
    ]);

    const result = await convertLeadToInvestor(pool as never, { reference: 'RS-1', actorId: 'admin-1' });

    expect(result.mode).toBe('created_pending_user');
    expect(result.appUserId).toBe('app-1');
    expect(calls.some((c) => /INSERT INTO app_users/i.test(c.sql) && /pending_email/i.test(c.sql))).toBe(true);
    expect(calls.some((c) => c.params?.includes('pending-lead:lead-1'))).toBe(true);
    expect(calls.some((c) => /UPDATE leads/i.test(c.sql) && /assigned_user_id/i.test(c.sql))).toBe(true);
  });

  it('upserts project access with committed capital and recomputes project committed amount', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'app-1', email_normalized: 'user@example.com', status: 'active' }],
      [{ id: 'opp-1', currency: 'EUR' }],
      [{ id: 'access-1', app_user_id: 'app-1', opportunity_id: 'opp-1', committed_amount_cents: 2500000, status: 'active' }],
      [{ committed_amount_cents: 2500000 }],
      [],
      [],
    ]);

    const result = await upsertProjectCapitalAssignment(pool as never, {
      appUserId: 'app-1',
      opportunityId: 'opp-1',
      committedAmountCents: 2500000,
      currency: 'EUR',
      status: 'active',
      notes: 'Ticket inicial',
      actorId: 'admin-1',
    });

    expect(result.assignment.committed_amount_cents).toBe(2500000);
    expect(calls.some((c) => /INSERT INTO project_user_access/i.test(c.sql) && /committed_amount_cents/i.test(c.sql))).toBe(true);
    expect(calls.some((c) => /UPDATE opportunities/i.test(c.sql) && /committed_amount_cents/i.test(c.sql))).toBe(true);
  });
});
