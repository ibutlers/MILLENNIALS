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

/**
 * Creates a pg Pool whose search_path defaults to `auth,public`.
 * Used by Better Auth so bare table references (e.g. `user`) resolve
 * to the `auth` schema where Better Auth tables live.
 */
export function createAuthPool(connectionString = getDatabaseUrl()) {
  // Append search_path via PGOPTIONS-like URL parameter
  const sep = connectionString.includes('?') ? '&' : '?';
  const authUrl = `${connectionString}${sep}options=-c%20search_path%3Dauth,public`;
  return createPool(authUrl);
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
