import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type { LeadRequest } from './schemas.js';

export type CreateLeadInput = ReturnType<typeof import('./schemas.js').normalizeLeadInput> & { privacyPolicyVersion: string };
export type CreateContactInput = ReturnType<typeof import('./contact-schema.js').normalizeContactInput>;

export class LeadRepository {
  constructor(private readonly pool: Pool) {}

  private publicReference() {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `RS-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async create(input: CreateLeadInput) {
    const opportunity = input.opportunitySlug
      ? await this.pool.query<{ id: string }>('SELECT id FROM opportunities WHERE slug = $1 AND visibility = $2 AND published_at IS NOT NULL LIMIT 1', [input.opportunitySlug, 'public'])
      : null;

    if (input.kind === 'opportunity_inquiry' && !opportunity?.rows[0]) {
      const error = new Error('Opportunity not found');
      error.name = 'OpportunityNotFoundError';
      throw error;
    }

    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reference = this.publicReference();
      try {
        const result = await this.pool.query<{ public_reference: string; kind: LeadRequest['kind']; status: 'new'; created_at: Date }>(
          `INSERT INTO leads (
            public_reference, kind, opportunity_id, first_name, last_name, email, phone, country_code,
            investment_range, message, source_path, referrer, utm_source, utm_medium, utm_campaign,
            privacy_policy_version, privacy_accepted_at, risk_acknowledged_at, marketing_opt_in_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
          ) RETURNING public_reference, kind::text, status::text, created_at`,
          [
            reference,
            input.kind,
            opportunity?.rows[0]?.id ?? null,
            input.firstName,
            input.lastName,
            input.email,
            input.phone ?? null,
            input.countryCode ?? null,
            input.investmentRange ?? null,
            input.message ?? null,
            input.sourcePath,
            input.referrer ?? null,
            input.utmSource ?? null,
            input.utmMedium ?? null,
            input.utmCampaign ?? null,
            input.privacyPolicyVersion,
            now,
            input.riskAcknowledged ? now : null,
            input.marketingOptIn ? now : null
          ]
        );
        const row = result.rows[0];
        return { publicReference: row.public_reference, kind: row.kind, status: row.status, createdAt: row.created_at.toISOString() };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === '23505' && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Unable to create lead reference');
  }

  async createContact(input: CreateContactInput) {
    const now = new Date();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reference = this.publicReference();
      try {
        const result = await this.pool.query<{ public_reference: string; status: 'new'; created_at: Date }>(
          `INSERT INTO leads (
            public_reference, kind, first_name, email, phone, subject, message, source_path,
            privacy_accepted_at, status
          ) VALUES (
            $1,'general_contact',$2,$3,$4,$5,$6,$7,$8,'new'
          ) RETURNING public_reference, status::text, created_at`,
          [
            reference,
            input.name,
            input.email,
            input.phone ?? null,
            input.subject,
            input.message,
            '/contacto',
            now
          ]
        );
        const row = result.rows[0];
        return { publicReference: row.public_reference, status: row.status, createdAt: row.created_at.toISOString() };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === '23505' && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Unable to create contact reference');
  }
}
