import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('database migrations', () => {
  const opportunitiesSql = readFileSync(resolve(__dirname, 'db/migrations/0001_create_opportunities.sql'), 'utf8');
  const leadsSql = readFileSync(resolve(__dirname, 'db/migrations/0002_create_leads.sql'), 'utf8');

  it('creates required public opportunity tables and migration ledger', () => {
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS opportunities');
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS opportunity_media');
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS opportunity_highlights');
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS opportunity_risks');
    expect(opportunitiesSql).toContain('CREATE TABLE IF NOT EXISTS opportunity_milestones');
  });

  it('defines opportunity enums and constraints for status, visibility, risk, unique slug and relationships', () => {
    for (const value of ['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'commercializing', 'closed', 'cancelled']) expect(opportunitiesSql).toContain(`'${value}'`);
    for (const value of ['public', 'private', 'unlisted', 'draft', 'low', 'medium', 'high', 'very_high']) expect(opportunitiesSql).toContain(`'${value}'`);
    expect(opportunitiesSql).toMatch(/slug text NOT NULL UNIQUE/);
    expect(opportunitiesSql).toMatch(/REFERENCES opportunities\(id\) ON DELETE CASCADE/g);
    expect(opportunitiesSql).toContain('target_amount_cents bigint NOT NULL CHECK');
    expect(opportunitiesSql).toContain('target_return_bps integer CHECK');
  });

  it('creates leads additively with kind/status enums, unique reference, consent fields and opportunity integrity', () => {
    expect(leadsSql).toContain("CREATE TYPE lead_kind AS ENUM ('access_request', 'opportunity_inquiry', 'general_contact')");
    expect(leadsSql).toContain("CREATE TYPE lead_status AS ENUM ('new', 'in_review', 'contacted', 'qualified', 'closed', 'rejected')");
    expect(leadsSql).toContain('CREATE TABLE leads');
    expect(leadsSql).toContain('public_reference text NOT NULL UNIQUE');
    expect(leadsSql).toContain('email text NOT NULL CHECK (email = lower(email)');
    expect(leadsSql).toContain('privacy_accepted_at timestamptz NOT NULL');
    expect(leadsSql).toContain('marketing_opt_in_at timestamptz');
    expect(leadsSql).toContain('REFERENCES opportunities(id) ON DELETE SET NULL');
    expect(leadsSql).toContain('CONSTRAINT opportunity_required_for_inquiry');
  });
});
