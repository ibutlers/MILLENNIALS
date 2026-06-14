import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createPool } from './pool.js';

const MIGRATION_LOCK_ID = 729527002;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function migrationsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), 'migrations');
}

function checksum(sql: string) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function runMigrations(pool: Pool = createPool()): Promise<MigrationResult> {
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query("SET statement_timeout TO '30s'");
    const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [MIGRATION_LOCK_ID]);
    if (!lock.rows[0]?.locked) {
      throw new Error('Another migration process is already running');
    }
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');

    const files = (await readdir(migrationsDir())).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const sql = await readFile(join(migrationsDir(), file), 'utf8');
      const hash = checksum(sql);
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE id = $1', [file]);

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== hash) {
          throw new Error(`Migration checksum mismatch: ${file}`);
        }
        skipped.push(file);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [file, hash]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return { applied, skipped };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = createPool();
  runMigrations(pool)
    .then((result) => {
      console.log(JSON.stringify({ status: 'ok', ...result }));
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Migration failed' }));
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
