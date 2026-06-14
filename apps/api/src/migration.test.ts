import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('initial database migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0001_create_opportunities.sql'), 'utf8');

  it('creates required public opportunity tables and migration ledger', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS opportunities');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS opportunity_media');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS opportunity_highlights');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS opportunity_risks');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS opportunity_milestones');
  });

  it('defines enums and constraints for status, visibility, risk, unique slug and relationships', () => {
    for (const value of ['coming_soon', 'open', 'funding', 'funded', 'in_execution', 'commercializing', 'closed', 'cancelled']) {
      expect(sql).toContain(`'${value}'`);
    }
    for (const value of ['public', 'private', 'unlisted', 'draft', 'low', 'medium', 'high', 'very_high']) {
      expect(sql).toContain(`'${value}'`);
    }
    expect(sql).toMatch(/slug text NOT NULL UNIQUE/);
    expect(sql).toMatch(/REFERENCES opportunities\(id\) ON DELETE CASCADE/g);
    expect(sql).toContain('target_amount_cents bigint NOT NULL CHECK');
    expect(sql).toContain('target_return_bps integer CHECK');
  });
});
