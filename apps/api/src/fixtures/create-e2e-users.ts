/**
 * E2E User Fixtures — creates test users directly via DB (no registration endpoint).
 * ONLY runs when E2E_TEST_MODE=true and NODE_ENV=test|e2e.
 * Usage: node dist/fixtures/create-e2e-users.js [--credentials-file /tmp/e2e-creds.json]
 */

import { randomUUID } from 'node:crypto';
import { writeFileSync, chmodSync } from 'node:fs';
import { hashPassword } from '../auth/password.js';
import { getPool } from '../db/pool.js';

// ═══ Safety guards ═══
const E2E_MODE = process.env.E2E_TEST_MODE === 'true';
const NODE_ENV = process.env.NODE_ENV || '';

if (!E2E_MODE && NODE_ENV !== 'test' && NODE_ENV !== 'e2e') {
  console.error('ERROR: This script requires E2E_TEST_MODE=true or NODE_ENV=test|e2e');
  console.error(`  E2E_TEST_MODE=${process.env.E2E_TEST_MODE || '(unset)'}`);
  console.error(`  NODE_ENV=${NODE_ENV}`);
  process.exit(1);
}

// ═══ Users to create ═══
const USERS = [
  { email: 'admin@e2e.realstate.test',   password: 'AdminE2E-Pass123!',   name: 'Admin E2E',   roles: ['admin'] },
  { email: 'operator@e2e.realstate.test', password: 'OperatorE2E-Pass123!', name: 'Operator E2E', roles: ['operator'] },
  { email: 'investor@e2e.realstate.test', password: 'InvestorE2E-Pass123!', name: 'Investor E2E', roles: ['investor'] },
];

interface CreatedUser {
  reference: string;
  email: string;
  roles: string[];
}

async function main() {
  const pool = getPool();

  // Verify we're connected to a test database
  const { rows: [{ current_database }] } = await pool.query<{ current_database: string }>('SELECT current_database()');
  if (!current_database.includes('e2e') && !current_database.includes('test')) {
    console.error(`ERROR: Database "${current_database}" does not appear to be an E2E database. Aborting.`);
    process.exit(1);
  }
  console.log(`Connected to E2E database: ${current_database}`);

  const created: CreatedUser[] = [];

  for (const user of USERS) {
    // Normalize email
    const emailNormalized = user.email.toLowerCase().trim();

    // Check if user already exists (idempotent)
    const { rows: [existing] } = await pool.query(
      'SELECT id, public_reference, email FROM users WHERE email_normalized = $1',
      [emailNormalized]
    );

    if (existing) {
      console.log(`  User ${user.email} already exists (${existing.public_reference}) — skipping creation`);
      // Still ensure roles
      for (const role of user.roles) {
        await pool.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [existing.id, role]
        );
      }
      created.push({ reference: existing.public_reference, email: user.email, roles: user.roles });
      continue;
    }

    // Hash password using the real Argon2id function
    const passwordHash = await hashPassword(user.password);

    // Insert user
    const id = randomUUID();
    const publicReference = `USR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO users (id, public_reference, email, email_normalized, name, password_hash, status, email_verified_at, created_at, updated_at, version)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7, $7, 1)`,
      [id, publicReference, user.email, emailNormalized, user.name, passwordHash, now]
    );

    // Assign roles
    for (const role of user.roles) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, role]
      );
    }

    // Audit
    await pool.query(
      "INSERT INTO audit_events (user_id, event_type, entity_type, entity_reference, summary) VALUES ($1, $2, $3, $4, $5)",
      [null, 'account_created', 'user', publicReference, `E2E fixture user: ${user.email}`]
    ).catch(() => {});

    created.push({ reference: publicReference, email: user.email, roles: user.roles });
    console.log(`  Created user: ${user.email} (${publicReference}) roles=[${user.roles.join(',')}]`);
  }

  // Write credentials file for Playwright
  const credsFile = process.argv.find(a => a.startsWith('--credentials-file='))?.split('=')[1];
  if (credsFile) {
    const creds = USERS.map((u, i) => ({
      email: u.email,
      password: u.password,
      reference: created[i]?.reference || '',
      roles: u.roles,
    }));
    writeFileSync(credsFile, JSON.stringify({ users: creds, created_at: new Date().toISOString() }, null, 2));
    chmodSync(credsFile, 0o600);
    console.log(`Credentials written to ${credsFile} (permissions: 600)`);
  }

  await pool.end();
  console.log(`Done. ${created.length} users ready.`);
}

main().catch((err) => {
  console.error('Fatal error creating E2E users:', err.message);
  process.exit(1);
});
