import { describe, expect, it, vi } from 'vitest';
import {
  approveInvestmentRequest,
  confirmInvestmentRequest,
  createInvestmentRequest,
  reportInvestmentTransfer,
} from './investment-requests.js';

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

describe('investment request workflow', () => {
  it('lets an active investor request investment only in open/funding public projects', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'opp-1', slug: 'vigo-open', status: 'open', visibility: 'public', published_at: new Date().toISOString(), currency: 'EUR', minimum_investment_cents: 1000000, target_amount_cents: 100000000, committed_amount_cents: 20000000 }],
      [],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'requested', requested_amount_cents: 2500000 }],
      [],
      [],
    ]);

    const result = await createInvestmentRequest(pool as never, {
      appUserId: 'app-1',
      opportunityIdOrSlug: 'vigo-open',
      amountCents: 2500000,
      currency: 'EUR',
      message: 'Quiero participar',
    });

    expect(result.public_reference).toBe('IR-TEST');
    expect(result.status).toBe('requested');
    expect(calls.some((c) => /INSERT INTO investment_requests/i.test(c.sql))).toBe(true);
    expect(calls.some((c) => /auth_audit_events/i.test(c.sql) && c.params?.includes('investment_request_created'))).toBe(true);
  });

  it('rejects requests below the project minimum ticket before inserting anything', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'opp-1', slug: 'vigo-open', status: 'open', visibility: 'public', published_at: new Date().toISOString(), currency: 'EUR', minimum_investment_cents: 1000000, target_amount_cents: 100000000, committed_amount_cents: 0 }],
    ]);

    await expect(createInvestmentRequest(pool as never, {
      appUserId: 'app-1',
      opportunityIdOrSlug: 'vigo-open',
      amountCents: 500000,
      currency: 'EUR',
    })).rejects.toMatchObject({ code: 'amount_below_minimum', statusCode: 422 });

    expect(calls.some((c) => /INSERT INTO investment_requests/i.test(c.sql))).toBe(false);
  });

  it('approval moves the request to pending transfer without granting project access yet', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'requested', app_user_id: 'app-1', opportunity_id: 'opp-1', requested_amount_cents: 2500000, currency: 'EUR' }],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'approved_pending_transfer', approved_amount_cents: 2500000 }],
      [],
      [],
    ]);

    const result = await approveInvestmentRequest(pool as never, {
      reference: 'IR-TEST',
      actorId: 'admin-1',
      approvedAmountCents: 2500000,
      adminNotes: 'Enviar justificante tras transferencia',
    });

    expect(result.status).toBe('approved_pending_transfer');
    expect(calls.some((c) => /INSERT INTO project_user_access/i.test(c.sql))).toBe(false);
  });

  it('investor can report a transfer after approval', async () => {
    const { pool } = makeClient([
      [],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'approved_pending_transfer', app_user_id: 'app-1', approved_amount_cents: 2500000 }],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'transfer_reported', transfer_reference: 'TR-123' }],
      [],
      [],
    ]);

    const result = await reportInvestmentTransfer(pool as never, {
      reference: 'IR-TEST',
      appUserId: 'app-1',
      transferReference: 'TR-123',
      transferNotes: 'Enviada hoy',
    });

    expect(result.status).toBe('transfer_reported');
    expect(result.transfer_reference).toBe('TR-123');
  });

  it('confirmation grants project access and recomputes project committed capital', async () => {
    const { pool, calls } = makeClient([
      [],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'transfer_reported', app_user_id: 'app-1', opportunity_id: 'opp-1', approved_amount_cents: 2500000, currency: 'EUR' }],
      [{ id: 'req-1', public_reference: 'IR-TEST', status: 'confirmed', confirmed_at: new Date().toISOString() }],
      [{ id: 'access-1' }],
      [],
      [],
    ]);

    const result = await confirmInvestmentRequest(pool as never, {
      reference: 'IR-TEST',
      actorId: 'admin-1',
      confirmationNotes: 'Transferencia conciliada',
    });

    expect(result.status).toBe('confirmed');
    expect(calls.some((c) => /INSERT INTO project_user_access/i.test(c.sql) && /committed_amount_cents/i.test(c.sql))).toBe(true);
    expect(calls.some((c) => /UPDATE opportunities/i.test(c.sql) && /committed_amount_cents/i.test(c.sql))).toBe(false);
  });
});
