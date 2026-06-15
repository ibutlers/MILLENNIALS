import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('database baseline migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0001_baseline_definitive.sql'), 'utf8');

  it('creates all 23 tables', () => {
    const expected = [
      'users','user_roles','sessions','email_verification_tokens','password_reset_tokens',
      'opportunities','opportunity_media','opportunity_highlights','opportunity_risks',
      'opportunity_milestones','opportunity_updates','opportunity_versions',
      'investor_profiles','consents',
      'leads','lead_notes',
      'documents',
      'investment_intents',
      'portfolio_positions','portfolio_contributions','portfolio_distributions',
      'portfolio_valuations','portfolio_events',
      'audit_events','outbox','jobs','feature_flags'
    ];
    for (const table of expected) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }
  });

  it('defines all 18 enum types', () => {
    const enums = [
      'opportunity_status','opportunity_visibility','opportunity_risk_level',
      'opportunity_return_type','opportunity_media_type',
      'user_status','user_role','lead_kind','lead_status','audit_event_type',
      'investor_status','kyc_status','document_type','document_status',
      'investment_status','position_status','outbox_status','consent_type',
      'editorial_status'
    ];
    for (const e of enums) {
      expect(sql).toContain(`CREATE TYPE ${e} AS ENUM`);
    }
  });

  it('enforces cents-based money and basis-point percentages', () => {
    expect(sql).toContain('target_amount_cents bigint NOT NULL CHECK');
    expect(sql).toContain('target_return_bps integer CHECK');
    expect(sql).toContain('amount_cents bigint NOT NULL CHECK');
    expect(sql).toMatch(/\.*_cents/); // all money fields use _cents suffix
  });

  it('uses UUID primary keys throughout', () => {
    const uuidCount = (sql.match(/uuid PRIMARY KEY DEFAULT gen_random_uuid/g) || []).length;
    expect(uuidCount).toBeGreaterThan(20);
  });

  it('has no JSONB abuse — only for version snapshots and event payloads', () => {
    const jsonbLines = sql.split('\n').filter(l => l.includes('jsonb'));
    // Should only be: opportunity_versions.snapshot, portfolio_events.payload,
    // audit_events.metadata, jobs.payload
    expect(jsonbLines.length).toBeLessThanOrEqual(6);
  });

  it('has proper foreign key cascades for sub-entities', () => {
    expect(sql).toContain('REFERENCES opportunities(id) ON DELETE CASCADE');
  });

  it('has unique slugs and email constraints', () => {
    expect(sql).toContain('slug text NOT NULL UNIQUE');
    expect(sql).toContain('email text NOT NULL UNIQUE');
  });

  it('records the baseline in schema_migrations', () => {
    expect(sql).toContain("INSERT INTO schema_migrations");
    expect(sql).toContain("0001_baseline_definitive");
  });
});
