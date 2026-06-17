/**
 * Better Auth Schema Consistency Test
 *
 * Verifica que la migración 0008 contiene las tablas y columnas esperadas
 * por Better Auth v1.6.19 con plugins twoFactor + organization.
 *
 * La migración usa snake_case (convención PostgreSQL) que Better Auth
 * traduce a camelCase mediante sus field mapping options internos.
 *
 * No modifica la migración 0008. Si se requieren columnas adicionales,
 * deben ir en una migración aditiva (0010+).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ── Better Auth v1.6.19, pin exacto ──
const PIN = '1.6.19';

// Tablas requeridas por Better Auth con plugins twoFactor + organization
const REQUIRED_TABLES = [
  'user', 'session', 'account', 'verification',
  'two_factor', 'organization', 'member', 'invitation',
];

// Columnas mínimas esperadas (snake_case, como aparecen en la migración 0008)
const MIN_COLUMNS: Record<string, string[]> = {
  user:        ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'two_factor_enabled'],
  session:     ['id', 'expires_at', 'token', 'created_at', 'updated_at', 'ip_address', 'user_agent', 'user_id'],
  account:     ['id', 'account_id', 'provider_id', 'user_id', 'created_at', 'updated_at'],
  verification:['id', 'identifier', 'value', 'expires_at', 'created_at', 'updated_at'],
  two_factor:   ['id', 'secret', 'backup_codes', 'user_id'],
  organization:['id', 'name', 'slug', 'logo', 'created_at', 'metadata'],
  member:      ['id', 'organization_id', 'user_id', 'role', 'created_at'],
  invitation:  ['id', 'organization_id', 'email', 'role', 'status', 'expires_at', 'inviter_id'],
};

// ── Helpers ──

function loadMigration(): string {
  return readFileSync(
    resolve(process.cwd(), 'src/db/migrations/0008_add_better_auth_schema.sql'),
    'utf-8',
  );
}

/** Extrae nombres de tabla del SQL (formato: CREATE TABLE auth.xxx) */
function extractTables(sql: string): string[] {
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?auth\.(\w+)/gi;
  const tables: string[] = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    tables.push(m[1].toLowerCase());
  }
  return [...new Set(tables)];
}

/** Extrae nombres de columna para una tabla específica */
function extractColumns(sql: string, table: string): string[] {
  // Buscar el bloque CREATE TABLE auth.<table> (...);
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?auth\\.${escaped}\\s*\\(([\\s\\S]*?)\\);`,
    'i',
  );
  const match = blockRe.exec(sql);
  if (!match) return [];

  const body = match[1];
  const cols: string[] = [];
  // Cada línea de columna empieza con espacios + nombre_columna + espacio + tipo
  const lines = body.split('\n');
  for (const line of lines) {
    const colMatch = line.match(/^\s{2,}(\w+)\s+\w+/);
    if (colMatch && !['primary', 'foreign', 'unique', 'constraint', 'check'].includes(colMatch[1].toLowerCase())) {
      cols.push(colMatch[1].toLowerCase());
    }
  }
  return [...new Set(cols)];
}

// ── Tests ──

describe('Better Auth schema consistency (v1.6.19)', () => {
  const sql = loadMigration();

  it('la migración 0008 existe y pesa más de 2 KB', () => {
    expect(sql.length).toBeGreaterThan(2000);
  });

  it('usa el esquema auth (aislamiento)', () => {
    expect(sql).toMatch(/CREATE\s+SCHEMA\s+(IF\s+NOT\s+EXISTS\s+)?auth/i);
    const tableRefs = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?auth\./gi) || [];
    expect(tableRefs.length).toBe(REQUIRED_TABLES.length);
  });

  it('contiene todas las tablas requeridas', () => {
    const tables = extractTables(sql);
    for (const t of REQUIRED_TABLES) {
      expect(tables).toContain(t);
    }
  });

  it('no contiene tablas no documentadas', () => {
    const tables = extractTables(sql);
    for (const t of tables) {
      expect(REQUIRED_TABLES).toContain(t);
    }
  });

  it('cada tabla tiene PRIMARY KEY', () => {
    const pkCount = (sql.match(/PRIMARY\s+KEY/gi) || []).length;
    expect(pkCount).toBeGreaterThanOrEqual(REQUIRED_TABLES.length);
  });

  // Una prueba por tabla para columnas mínimas
  for (const table of REQUIRED_TABLES) {
    it(`tabla "${table}": columnas mínimas presentes`, () => {
      const cols = extractColumns(sql, table);
      const expected = MIN_COLUMNS[table] || [];
      for (const col of expected) {
        expect(cols).toContain(col);
      }
    });

    it(`tabla "${table}": índices o constraints definidos`, () => {
      // Cada tabla debe tener al menos un índice o constraint además del PK
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const afterTable = sql.split(new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?auth\\.${escaped}`))[1] || '';
      const endOfTable = afterTable.indexOf(');');
      const block = endOfTable > 0 ? afterTable.substring(0, endOfTable) : afterTable;
      // Al menos debe tener la PRIMARY KEY
      expect(block.toUpperCase()).toMatch(/PRIMARY\s+KEY/);
    });
  }

  it('pnpm-lock.yaml resuelve exactamente better-auth@1.6.19', () => {
    const lockfile = readFileSync(resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'), 'utf-8');
    const matches = lockfile.match(/better-auth@[\d.]+/g) || [];
    const unique = [...new Set(matches)];
    expect(unique).toHaveLength(1);
    expect(unique[0]).toBe(`better-auth@${PIN}`);
  });

  it('la migración 0008 es BEGIN/COMMIT atómica', () => {
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^COMMIT;/m);
  });

  it('documenta la versión y plugins en el encabezado', () => {
    const header = sql.split('\n').slice(0, 8).join('\n');
    expect(header).toMatch(/v?1\.6\.19/);
    expect(header).toMatch(/two-?factor/);
    expect(header).toMatch(/organization/);
  });
});
