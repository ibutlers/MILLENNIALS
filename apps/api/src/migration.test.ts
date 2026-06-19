import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalMigrationsDir, listMigrationFiles, resolveMigrationsDir } from './db/migrate.js';

describe('database baseline migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0001_baseline_definitive.sql'), 'utf8');

  it('creates all 27 domain tables (schema_migrations is runner-owned)', () => {
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
    expect(sql).toMatch(/target_amount_cents\s+bigint\s+NOT NULL/);
    expect(sql).toMatch(/target_return_bps\s+integer\s+CHECK/);
    expect(sql).toMatch(/amount_cents\s+bigint\s+NOT NULL\s+CHECK/);
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
    expect(sql).toMatch(/slug\s+text\s+NOT NULL UNIQUE/);
    expect(sql).toMatch(/email\s+text\s+NOT NULL UNIQUE/);
  });

  it('does NOT contain INSERT INTO schema_migrations (runner handles it)', () => {
    expect(sql).not.toContain("INSERT INTO schema_migrations");
  });

  it('does NOT use IF NOT EXISTS on tables (deterministic, run once)', () => {
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS/);
  });

  it('uses CREATE EXTENSION IF NOT EXISTS only for pgcrypto bootstrap', () => {
    const extMatches = (sql.match(/CREATE EXTENSION IF NOT EXISTS/g) || []);
    expect(extMatches.length).toBe(1);
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  });
});


describe('restore lineage migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0004_add_opportunity_restore_lineage.sql'), 'utf8');
  const migrationNames = readdirSync(resolve(__dirname, 'db/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  it('keeps the canonical migration prefix order and unique numeric prefixes', () => {
    expect(migrationNames.slice(0, 4)).toEqual([
      '0001_baseline_definitive.sql',
      '0002_add_lead_columns.sql',
      '0003_align_auth_schema.sql',
      '0004_add_opportunity_restore_lineage.sql',
    ]);

    expect(new Set(migrationNames).size).toBe(migrationNames.length);
    const numericPrefixes = migrationNames.map((name) => name.slice(0, 4));
    expect(new Set(numericPrefixes).size).toBe(numericPrefixes.length);
  });

  it('alters opportunities with nullable lineage columns using the expected types', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+opportunities[\s\S]*ADD\s+COLUMN\s+restored_from_opportunity_id\s+uuid[\s\S]*ADD\s+COLUMN\s+restored_from_version\s+integer/i);
  });

  it('requires lineage to be fully null or fully populated', () => {
    expect(sql).toMatch(/restored_from_opportunity_id\s+IS\s+NULL\s+AND\s+restored_from_version\s+IS\s+NULL[\s\S]*OR[\s\S]*restored_from_opportunity_id\s+IS\s+NOT\s+NULL\s+AND\s+restored_from_version\s+IS\s+NOT\s+NULL/i);
  });

  it('enforces positive restored version values', () => {
    expect(sql).toMatch(/restored_from_version\s+IS\s+NULL\s+OR\s+restored_from_version\s+>\s+0/i);
  });

  it('adds FK and an ordered lineage index', () => {
    expect(sql).toMatch(/FOREIGN\s+KEY\s*\(\s*restored_from_opportunity_id\s*\)\s+REFERENCES\s+opportunities\s*\(\s*id\s*\)/i);
    expect(sql).toMatch(/CREATE\s+INDEX\s+opportunities_restore_lineage_idx\s+ON\s+opportunities\s*\(\s*restored_from_opportunity_id\s*,\s*restored_from_version\s*\)/i);
  });

  it('is deterministic and does not manipulate runner-owned migration state', () => {
    expect(sql).not.toMatch(/IF NOT EXISTS/i);
    expect(sql).not.toMatch(/\bschema_migrations\b/i);
    expect(sql).not.toMatch(/ON CONFLICT/i);
  });
});


describe('project access capital migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0015_add_project_access_capital.sql'), 'utf8');

  it('adds explicit per-investor committed capital to project access grants', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+project_user_access[\s\S]*ADD\s+COLUMN\s+committed_amount_cents\s+bigint\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    expect(sql).toMatch(/CHECK\s*\(\s*committed_amount_cents\s+>=\s+0\s*\)/i);
    expect(sql).toMatch(/ADD\s+COLUMN\s+currency\s+text\s+NOT\s+NULL\s+DEFAULT\s+'EUR'/i);
    expect(sql).toMatch(/ADD\s+COLUMN\s+notes\s+text/i);
  });

  it('is deterministic and does not manipulate runner-owned migration state', () => {
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i);
    expect(sql).not.toMatch(/\bschema_migrations\b/i);
  });
});


describe('investment requests migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0016_add_investment_requests.sql'), 'utf8');

  it('creates the operational request lifecycle table linked to app users and opportunities', () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+investment_requests/i);
    expect(sql).toMatch(/app_user_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+app_users\s*\(\s*id\s*\)/i);
    expect(sql).toMatch(/opportunity_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+opportunities\s*\(\s*id\s*\)/i);
    expect(sql).toMatch(/status\s+text\s+NOT\s+NULL\s+DEFAULT\s+'requested'[\s\S]*approved_pending_transfer[\s\S]*transfer_reported[\s\S]*confirmed/i);
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+investment_requests_single_active_idx/i);
  });

  it('is runner-owned and does not hide drift with IF NOT EXISTS', () => {
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
    expect(sql).not.toMatch(/\bschema_migrations\b/i);
  });
});


describe('opportunity project financing migration', () => {
  const sql = readFileSync(resolve(__dirname, 'db/migrations/0017_add_opportunity_project_financing.sql'), 'utf8');

  it('adds explicit public project total and bank financing amounts', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+opportunities[\s\S]*ADD\s+COLUMN\s+project_total_amount_cents\s+bigint/i);
    expect(sql).toMatch(/ADD\s+COLUMN\s+bank_financing_amount_cents\s+bigint/i);
    expect(sql).toMatch(/project_total_amount_cents\s+IS\s+NULL\s+OR\s+project_total_amount_cents\s+>=\s+0/i);
    expect(sql).toMatch(/bank_financing_amount_cents\s+IS\s+NULL\s+OR\s+bank_financing_amount_cents\s+>=\s+0/i);
  });

  it('is runner-owned and deterministic', () => {
    expect(sql).not.toMatch(/IF\s+NOT\s+EXISTS/i);
    expect(sql).not.toMatch(/schema_migrations/i);
  });
});


describe('migration directory resolution', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMigrationsDir = process.env.MIGRATIONS_DIR;
  const createdDirs: string[] = [];

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMigrationsDir === undefined) {
      delete process.env.MIGRATIONS_DIR;
    } else {
      process.env.MIGRATIONS_DIR = originalMigrationsDir;
    }
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempMigrationDir() {
    const dir = mkdtempSync(join(tmpdir(), 'realstate-migrations-test-'));
    createdDirs.push(dir);
    return dir;
  }

  it('uses the canonical built migrations directory by default', () => {
    delete process.env.MIGRATIONS_DIR;
    process.env.NODE_ENV = 'production';

    expect(resolveMigrationsDir()).toBe(canonicalMigrationsDir());
  });

  it('allows an absolute MIGRATIONS_DIR override only in e2e/test environments', () => {
    const dir = tempMigrationDir();
    writeFileSync(join(dir, '0001_example.sql'), 'SELECT 1;');
    process.env.NODE_ENV = 'e2e';
    process.env.MIGRATIONS_DIR = dir;

    expect(resolveMigrationsDir()).toBe(resolve(dir));
  });

  it('rejects MIGRATIONS_DIR override outside test/e2e environments', () => {
    const dir = tempMigrationDir();
    process.env.NODE_ENV = 'production';
    process.env.MIGRATIONS_DIR = dir;

    expect(() => resolveMigrationsDir()).toThrow(/only allowed/);
  });

  it('rejects a non-existing MIGRATIONS_DIR override', () => {
    process.env.NODE_ENV = 'test';
    process.env.MIGRATIONS_DIR = join(tmpdir(), 'realstate-missing-migrations-dir');

    expect(() => resolveMigrationsDir()).toThrow(/existing directory/);
  });

  it('loads only local .sql files in deterministic order', async () => {
    const dir = tempMigrationDir();
    const outside = tempMigrationDir();
    writeFileSync(join(dir, '0002_second.sql'), 'SELECT 2;');
    writeFileSync(join(dir, '0001_first.sql'), 'SELECT 1;');
    writeFileSync(join(dir, 'notes.txt'), 'ignored');
    writeFileSync(join(outside, '0003_outside.sql'), 'SELECT 3;');
    symlinkSync(join(outside, '0003_outside.sql'), join(dir, '0003_link.sql'));

    await expect(listMigrationFiles(dir)).resolves.toEqual([
      '0001_first.sql',
      '0002_second.sql',
    ]);
  });

  it('rejects duplicate numeric migration prefixes', async () => {
    const dir = tempMigrationDir();
    writeFileSync(join(dir, '0001_first.sql'), 'SELECT 1;');
    writeFileSync(join(dir, '0001_second.sql'), 'SELECT 2;');

    await expect(listMigrationFiles(dir)).rejects.toThrow(/Duplicate migration prefix/);
  });
});
