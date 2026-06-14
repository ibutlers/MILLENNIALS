import { getPool } from '../db/pool.js';
import { leadStatusSchema } from './schemas.js';

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function has(name: string) { return process.argv.includes(`--${name}`); }
function maskEmail(email: string) { const [u, d] = email.split('@'); return `${u.slice(0, 2)}***@${d ?? '***'}`; }
function maskPhone(phone: string | null) { return phone ? `${phone.slice(0, 3)}***${phone.slice(-2)}` : null; }

async function main() {
  const command = process.argv[2];
  const pool = getPool();
  try {
    if (command === 'summary') {
      const result = await pool.query('SELECT status::text, kind::text, count(*)::int AS count FROM leads GROUP BY status, kind ORDER BY status, kind');
      console.table(result.rows);
      return;
    }
    if (command === 'list') {
      const limit = Math.min(Number(arg('limit') ?? 20), 100);
      const status = arg('status');
      const showPii = has('show-pii');
      const values: unknown[] = [limit];
      let where = '';
      if (status) { leadStatusSchema.parse(status); values.push(status); where = 'WHERE status = $2'; }
      const result = await pool.query(`SELECT public_reference, kind::text, status::text, email, phone, source_path, created_at FROM leads ${where} ORDER BY created_at DESC LIMIT $1`, values);
      console.table(result.rows.map((row) => ({
        reference: row.public_reference,
        kind: row.kind,
        status: row.status,
        email: showPii ? row.email : maskEmail(row.email),
        phone: showPii ? row.phone : maskPhone(row.phone),
        sourcePath: row.source_path,
        createdAt: row.created_at
      })));
      return;
    }
    if (command === 'update') {
      const reference = arg('reference');
      const status = leadStatusSchema.parse(arg('status'));
      if (!reference) throw new Error('--reference is required');
      const result = await pool.query('UPDATE leads SET status = $1 WHERE public_reference = $2 RETURNING public_reference, status::text, updated_at', [status, reference]);
      if (!result.rowCount) throw new Error('Lead reference not found');
      console.table(result.rows);
      return;
    }
    throw new Error('Usage: leads.ts summary | list [--status new] [--limit 20] [--show-pii] | update --reference REF --status contacted');
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
