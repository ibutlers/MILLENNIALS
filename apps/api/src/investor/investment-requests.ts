import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

const OPEN_PROJECT_STATUSES = new Set(['open', 'funding']);
const ACTIVE_REQUEST_STATUSES = new Set(['requested', 'approved_pending_transfer', 'transfer_reported']);

export type InvestmentRequestStatus =
  | 'requested'
  | 'approved_pending_transfer'
  | 'transfer_reported'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

type DbRow = Record<string, unknown>;

function workflowError(code: string, message: string, statusCode: number): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(message), { code, statusCode });
}

function makeReference(): string {
  return `IR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function audit(client: PoolClient, params: {
  actorId?: string | null;
  action: string;
  subjectId?: string | null;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}) {
  await client.query(
    `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result, metadata)
     VALUES ($1,$2,$3,$4,$5,'success',$6::jsonb)`,
    [params.actorId ?? null, params.action, params.subjectId ?? null, params.resourceType, params.resourceId, JSON.stringify(params.metadata ?? {})],
  );
}

async function lockRequest(client: PoolClient, reference: string): Promise<DbRow> {
  const { rows: [request] } = await client.query(
    `SELECT * FROM investment_requests WHERE public_reference = $1 FOR UPDATE`,
    [reference],
  );
  if (!request) throw workflowError('not_found', 'Solicitud de inversión no encontrada.', 404);
  return request;
}

export async function createInvestmentRequest(
  pool: Pick<Pool, 'connect'>,
  input: { appUserId: string; opportunityIdOrSlug: string; amountCents: number; currency: string; message?: string | null },
): Promise<DbRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [opportunity] } = await client.query(
      `SELECT id, slug, status, visibility, published_at, currency, minimum_investment_cents,
              target_amount_cents, committed_amount_cents
       FROM opportunities
       WHERE id::text = $1 OR slug = $1
       FOR UPDATE`,
      [input.opportunityIdOrSlug],
    );
    if (!opportunity) throw workflowError('opportunity_not_found', 'Proyecto no encontrado.', 404);
    if (opportunity.visibility !== 'public' || !opportunity.published_at || !OPEN_PROJECT_STATUSES.has(String(opportunity.status))) {
      throw workflowError('opportunity_not_open', 'Este proyecto no está abierto a solicitudes de inversión.', 409);
    }

    const amountCents = Math.round(input.amountCents);
    const minimum = Number(opportunity.minimum_investment_cents);
    if (!Number.isFinite(amountCents) || amountCents < minimum) {
      throw workflowError('amount_below_minimum', 'El importe está por debajo del ticket mínimo del proyecto.', 422);
    }
    if (String(input.currency).toUpperCase() !== String(opportunity.currency).toUpperCase()) {
      throw workflowError('currency_mismatch', 'La moneda no coincide con el proyecto.', 422);
    }

    const existing = await client.query(
      `SELECT id, public_reference, status
       FROM investment_requests
       WHERE app_user_id = $1 AND opportunity_id = $2
         AND status IN ('requested','approved_pending_transfer','transfer_reported')
       LIMIT 1`,
      [input.appUserId, opportunity.id],
    );
    if (existing.rows[0]) {
      throw workflowError('active_request_exists', 'Ya existe una solicitud activa para este proyecto.', 409);
    }

    const publicReference = makeReference();
    const { rows: [created] } = await client.query(
      `INSERT INTO investment_requests (
         public_reference, app_user_id, opportunity_id, requested_amount_cents,
         currency, investor_message, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'requested')
       RETURNING *`,
      [publicReference, input.appUserId, opportunity.id, amountCents, String(input.currency).toUpperCase(), input.message ?? null],
    );

    await audit(client, {
      actorId: input.appUserId,
      action: 'investment_request_created',
      subjectId: input.appUserId,
      resourceType: 'investment_request',
      resourceId: String(created.public_reference),
      metadata: { opportunityId: opportunity.id, amountCents },
    });
    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function approveInvestmentRequest(
  pool: Pick<Pool, 'connect'>,
  input: { reference: string; actorId: string; approvedAmountCents: number; adminNotes?: string | null },
): Promise<DbRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await lockRequest(client, input.reference);
    if (request.status !== 'requested') throw workflowError('invalid_status', 'La solicitud no está pendiente de aceptación.', 409);
    const approvedAmount = Math.round(input.approvedAmountCents);
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) throw workflowError('invalid_amount', 'Importe aprobado no válido.', 422);

    const { rows: [updated] } = await client.query(
      `UPDATE investment_requests
       SET status='approved_pending_transfer', approved_amount_cents=$2, approved_by=$3,
           approved_at=now(), admin_notes=$4, updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [request.id, approvedAmount, input.actorId, input.adminNotes ?? null],
    );
    await audit(client, {
      actorId: input.actorId,
      action: 'investment_request_approved',
      subjectId: String(request.app_user_id),
      resourceType: 'investment_request',
      resourceId: String(request.public_reference),
      metadata: { approvedAmountCents: approvedAmount },
    });
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectInvestmentRequest(
  pool: Pick<Pool, 'connect'>,
  input: { reference: string; actorId: string; adminNotes?: string | null },
): Promise<DbRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await lockRequest(client, input.reference);
    if (!ACTIVE_REQUEST_STATUSES.has(String(request.status))) throw workflowError('invalid_status', 'La solicitud ya está cerrada.', 409);
    const { rows: [updated] } = await client.query(
      `UPDATE investment_requests
       SET status='rejected', rejected_by=$2, rejected_at=now(), admin_notes=COALESCE($3, admin_notes), updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [request.id, input.actorId, input.adminNotes ?? null],
    );
    await audit(client, {
      actorId: input.actorId,
      action: 'investment_request_rejected',
      subjectId: String(request.app_user_id),
      resourceType: 'investment_request',
      resourceId: String(request.public_reference),
      metadata: {},
    });
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function reportInvestmentTransfer(
  pool: Pick<Pool, 'connect'>,
  input: { reference: string; appUserId: string; transferReference: string; transferNotes?: string | null },
): Promise<DbRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await lockRequest(client, input.reference);
    if (request.app_user_id !== input.appUserId) throw workflowError('not_found', 'Solicitud de inversión no encontrada.', 404);
    if (request.status !== 'approved_pending_transfer') throw workflowError('invalid_status', 'La solicitud todavía no está aceptada para transferencia.', 409);

    const { rows: [updated] } = await client.query(
      `UPDATE investment_requests
       SET status='transfer_reported', transfer_reference=$2, transfer_notes=$3,
           transfer_reported_at=now(), updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [request.id, input.transferReference, input.transferNotes ?? null],
    );
    await audit(client, {
      actorId: input.appUserId,
      action: 'investment_transfer_reported',
      subjectId: input.appUserId,
      resourceType: 'investment_request',
      resourceId: String(request.public_reference),
      metadata: {},
    });
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmInvestmentRequest(
  pool: Pick<Pool, 'connect'>,
  input: { reference: string; actorId: string; confirmationNotes?: string | null },
): Promise<DbRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await lockRequest(client, input.reference);
    if (request.status !== 'transfer_reported') throw workflowError('invalid_status', 'La transferencia no ha sido reportada.', 409);
    const amount = Number(request.approved_amount_cents ?? request.requested_amount_cents);

    const { rows: [updated] } = await client.query(
      `UPDATE investment_requests
       SET status='confirmed', confirmed_by=$2, confirmed_at=now(),
           confirmation_notes=$3, updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [request.id, input.actorId, input.confirmationNotes ?? null],
    );

    await client.query(
      `INSERT INTO project_user_access (
         app_user_id, opportunity_id, status, granted_by, granted_at,
         committed_amount_cents, currency, notes
       ) VALUES ($1,$2,'active',$3,now(),$4,$5,$6)
       ON CONFLICT (app_user_id, opportunity_id) DO UPDATE SET
         status='active', granted_by=EXCLUDED.granted_by, granted_at=now(),
         revoked_by=NULL, revoked_at=NULL, reason=NULL,
         committed_amount_cents=EXCLUDED.committed_amount_cents,
         currency=EXCLUDED.currency,
         notes=EXCLUDED.notes
       RETURNING id`,
      [request.app_user_id, request.opportunity_id, input.actorId, amount, request.currency, input.confirmationNotes ?? 'Transferencia confirmada'],
    );

    await audit(client, {
      actorId: input.actorId,
      action: 'investment_request_confirmed',
      subjectId: String(request.app_user_id),
      resourceType: 'investment_request',
      resourceId: String(request.public_reference),
      metadata: { amountCents: amount, opportunityId: request.opportunity_id },
    });
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
