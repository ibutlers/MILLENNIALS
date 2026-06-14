import { Pool } from 'pg';

let sharedPool: Pool | null = null;

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return databaseUrl;
}

export function createPool(connectionString = getDatabaseUrl()) {
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 5_000),
    query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS ?? 6_000)
  });
}

export function getPool() {
  sharedPool ??= createPool();
  return sharedPool;
}

export async function closeSharedPool() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}
