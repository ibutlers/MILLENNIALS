import type { Pool, PoolClient } from 'pg';

export type LeadConversionMode =
  | 'activated_existing_user'
  | 'created_from_better_auth_user'
  | 'created_pending_user'
  | 'invitation_required';

export interface LeadConversionResult {
  mode: LeadConversionMode;
  lead: Record<string, unknown>;
  appUserId: string | null;
  emailNormalized: string;
}

export interface ProjectCapitalAssignmentInput {
  appUserId: string;
  opportunityId: string;
  committedAmountCents: number;
  currency: string;
  status: 'active' | 'revoked';
  notes?: string | null;
  actorId?: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pendingLeadAuthId(leadId: string): string {
  return `pending-lead:${leadId}`;
}

async function audit(client: PoolClient, params: {
  actorId?: string | null;
  action: string;
  subjectId?: string | null;
  resourceType: string;
  resourceId: string;
  result?: string;
  metadata?: Record<string, unknown>;
}) {
  await client.query(
    `INSERT INTO auth_audit_events (actor_id, action, subject_id, resource_type, resource_id, result, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [params.actorId ?? null, params.action, params.subjectId ?? null, params.resourceType, params.resourceId, params.result ?? 'success', JSON.stringify(params.metadata ?? {})],
  );
}

export async function convertLeadToInvestor(
  pool: Pick<Pool, 'connect'>,
  input: { reference: string; actorId?: string | null },
): Promise<LeadConversionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [lead] } = await client.query(
      `SELECT id, public_reference, email, first_name, last_name, status
       FROM leads
       WHERE public_reference = $1
       FOR UPDATE`,
      [input.reference],
    );

    if (!lead) {
      await client.query('ROLLBACK');
      const error = new Error('Lead not found') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'not_found';
      throw error;
    }

    const emailNormalized = normalizeEmail(String(lead.email));
    let appUserId: string | null = null;
    let mode: LeadConversionMode = 'invitation_required';

    const { rows: [existingAppUser] } = await client.query(
      `SELECT id, status, role FROM app_users WHERE email_normalized = $1 FOR UPDATE`,
      [emailNormalized],
    );

    if (existingAppUser) {
      const { rows: [activated] } = await client.query(
        `UPDATE app_users
         SET role = CASE WHEN role = 'admin' THEN role ELSE 'investor'::app_user_role END,
             status='active'::app_user_status,
             activated_at=COALESCE(activated_at, now()),
             suspended_at=NULL,
             revoked_at=NULL,
             updated_at=now()
         WHERE id=$1
         RETURNING id, status, role`,
        [existingAppUser.id],
      );
      appUserId = activated.id;
      mode = 'activated_existing_user';
    } else {
      const { rows: [betterAuthUser] } = await client.query(
        `SELECT id, name, email, email_verified, "twoFactorEnabled"
         FROM auth."user"
         WHERE lower(trim(email)) = $1
         FOR UPDATE`,
        [emailNormalized],
      );

      if (betterAuthUser) {
        const displayName = String(betterAuthUser.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || emailNormalized);
        const { rows: [created] } = await client.query(
          `INSERT INTO app_users (
             better_auth_user_id, email_normalized, display_name, role, status,
             email_verified_at, mfa_enabled_at, activated_at
           ) VALUES ($1,$2,$3,'investor','active',
             CASE WHEN $4::boolean THEN now() ELSE NULL END,
             CASE WHEN $5::boolean THEN now() ELSE NULL END,
             now()
           )
           RETURNING id, status, role`,
          [betterAuthUser.id, emailNormalized, displayName, Boolean(betterAuthUser.email_verified), Boolean(betterAuthUser.twoFactorEnabled)],
        );
        appUserId = created.id;
        mode = 'created_from_better_auth_user';
      } else {
        const displayName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || emailNormalized;
        const { rows: [created] } = await client.query(
          `INSERT INTO app_users (
             better_auth_user_id, email_normalized, display_name, role, status
           ) VALUES ($1,$2,$3,'investor','pending_email')
           ON CONFLICT (email_normalized) DO UPDATE SET
             display_name = COALESCE(app_users.display_name, EXCLUDED.display_name),
             role = CASE WHEN app_users.role = 'admin' THEN app_users.role ELSE 'investor'::app_user_role END,
             updated_at = now()
           RETURNING id, status, role`,
          [pendingLeadAuthId(String(lead.id)), emailNormalized, displayName],
        );
        appUserId = created.id;
        mode = 'created_pending_user';
      }
    }

    const { rows: [updatedLead] } = await client.query(
      `UPDATE leads
       SET status='converted'::lead_status,
           assigned_user_id=$2,
           updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [lead.id, appUserId],
    );

    await audit(client, {
      actorId: input.actorId,
      action: 'lead_converted',
      subjectId: appUserId,
      resourceType: 'lead',
      resourceId: String(lead.public_reference),
      metadata: { mode, emailNormalized },
    });

    await client.query('COMMIT');
    return { mode, lead: updatedLead, appUserId, emailNormalized };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertProjectCapitalAssignment(
  pool: Pick<Pool, 'connect'>,
  input: ProjectCapitalAssignmentInput,
): Promise<{ assignment: Record<string, unknown>; projectCommittedAmountCents: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [appUser] } = await client.query(
      `SELECT id, email_normalized, status FROM app_users WHERE id::text = $1 FOR UPDATE`,
      [input.appUserId],
    );
    if (!appUser) {
      await client.query('ROLLBACK');
      const error = new Error('User not found') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'user_not_found';
      throw error;
    }

    const { rows: [opportunity] } = await client.query(
      `SELECT id, currency FROM opportunities WHERE id::text = $1 OR slug = $1 FOR UPDATE`,
      [input.opportunityId],
    );
    if (!opportunity) {
      await client.query('ROLLBACK');
      const error = new Error('Opportunity not found') as Error & { statusCode?: number; code?: string };
      error.statusCode = 404;
      error.code = 'opportunity_not_found';
      throw error;
    }

    const amount = Math.max(0, Math.round(input.committedAmountCents));
    const { rows: [assignment] } = await client.query(
      `INSERT INTO project_user_access (
         app_user_id, opportunity_id, status, granted_by, granted_at,
         revoked_by, revoked_at, reason, committed_amount_cents, currency, notes
       ) VALUES (
         $1, $2, $3::project_access_status, $4::uuid, now(),
         CASE WHEN $3::text = 'revoked' THEN $4::uuid ELSE NULL END,
         CASE WHEN $3::text = 'revoked' THEN now() ELSE NULL END,
         $5, $6, $7, $8
       )
       ON CONFLICT (app_user_id, opportunity_id) DO UPDATE SET
         status = EXCLUDED.status,
         granted_by = CASE WHEN EXCLUDED.status = 'active' THEN EXCLUDED.granted_by ELSE project_user_access.granted_by END,
         granted_at = CASE WHEN EXCLUDED.status = 'active' THEN now() ELSE project_user_access.granted_at END,
         revoked_by = CASE WHEN EXCLUDED.status = 'revoked' THEN EXCLUDED.revoked_by ELSE NULL END,
         revoked_at = CASE WHEN EXCLUDED.status = 'revoked' THEN now() ELSE NULL END,
         reason = EXCLUDED.reason,
         committed_amount_cents = EXCLUDED.committed_amount_cents,
         currency = EXCLUDED.currency,
         notes = EXCLUDED.notes
       RETURNING *`,
      [appUser.id, opportunity.id, input.status, input.actorId ?? null, input.status === 'revoked' ? 'Revocado desde admin' : null, amount, input.currency.toUpperCase(), input.notes ?? null],
    );

    const { rows: [projectTotals] } = await client.query(
      `UPDATE opportunities o
       SET committed_amount_cents = COALESCE((
         SELECT SUM(committed_amount_cents)::bigint
         FROM project_user_access
         WHERE opportunity_id = o.id AND status = 'active'
       ), 0),
       updated_at = now()
       WHERE o.id = $1
       RETURNING committed_amount_cents`,
      [opportunity.id],
    );

    await audit(client, {
      actorId: input.actorId,
      action: 'project_capital_assignment_upserted',
      subjectId: appUser.id,
      resourceType: 'opportunity',
      resourceId: String(opportunity.id),
      metadata: {
        committedAmountCents: amount,
        currency: input.currency.toUpperCase(),
        status: input.status,
      },
    });

    await client.query('COMMIT');
    return {
      assignment,
      projectCommittedAmountCents: Number(projectTotals.committed_amount_cents ?? 0),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
