import { createPool } from '../db/pool.js';
import { AuthRepository } from './repository.js';

interface CliArgs {
  email?: string;
  reference?: string;
  'show-pii'?: boolean;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  const pool = createPool();
  const repo = new AuthRepository(pool);

  try {
    switch (command) {
      case 'list': await listUsers(repo, args); break;
      case 'create-admin': await createAdmin(repo, args); break;
      case 'disable': await disableUser(repo, args); break;
      case 'revoke-sessions': await revokeUserSessions(repo, args); break;
      default:
        console.error('Usage: pnpm users:{list|create-admin|disable|revoke-sessions} [--reference <ref>] [--email <email>] [--show-pii]');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && i + 1 < argv.length) { result.email = argv[++i]; continue; }
    if (argv[i] === '--reference' && i + 1 < argv.length) { result.reference = argv[++i]; continue; }
    if (argv[i] === '--show-pii') { result['show-pii'] = true; }
  }
  return result;
}

type Row = Record<string, unknown>;

async function listUsers(repo: AuthRepository, args: CliArgs): Promise<void> {
  const showPii = args['show-pii'] === true;
  const { rows } = await repo.pool.query(
    'SELECT id, public_reference, email, email_normalized, status, email_verified_at, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 100'
  );
  const mapped = (rows as Row[]).map((r: Row) => ({
    reference: r.public_reference,
    email: showPii ? r.email : maskEmail(String(r.email ?? '')),
    status: r.status,
    emailVerified: !!r.email_verified_at,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));
  console.log(JSON.stringify(mapped, null, 2));
}

function maskEmail(email: string): string {
  if (!email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain.slice(0, 2)}***`;
}

async function createAdmin(repo: AuthRepository, args: CliArgs): Promise<void> {
  const email = args.email;
  if (!email || !email.includes('@')) {
    console.error('Error: --email is required for create-admin');
    process.exit(1);
  }
  console.error('Enter password (min 8 chars, input hidden):');

  const password = await readPassword();
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  const { hash } = await import('@node-rs/argon2');
  const emailNormalized = email.toLowerCase().trim();
  const passwordHash = await hash(password, {
    algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1, outputLen: 32,
  } as never);

  const existing = await repo.findUserByEmail(emailNormalized);
  if (existing) {
    console.error(`User ${emailNormalized} already exists.`);
    process.exit(1);
  }

  const user = await repo.createUser({
    email: email.trim(), emailNormalized, passwordHash, name: 'Administrador',
  });

  await repo.addUserRole(user.id, 'admin');
  await repo.addUserRole(user.id, 'operator');
  await repo.verifyEmail(user.id);
  await repo.recordAuditEvent({
    eventType: 'role_changed', userId: user.id, metadata: { roles: ['admin', 'operator', 'investor'] },
  });

  console.log(JSON.stringify({
    id: user.id, publicReference: user.publicReference, email: emailNormalized,
    status: user.status, createdAt: user.createdAt,
  }, null, 2));
}

async function readPassword(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const { stdin } = process;
    if (stdin.isTTY) stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      if (str === '\n' || str === '\r\n' || str === '\r') {
        if (stdin.isTTY) stdin.setRawMode?.(false);
        stdin.pause();
        resolve(data.trim());
        return;
      }
      if (str === '\x7f' || str === '\b') { data = data.slice(0, -1); return; }
      data += str;
    });
  });
}

async function findUserIdByRef(repo: AuthRepository, ref: string): Promise<string> {
  const { rows } = await repo.pool.query('SELECT id FROM users WHERE public_reference = $1', [ref]);
  const row = (rows as Row[])[0];
  if (!row) { console.error(`User with reference ${ref} not found.`); process.exit(1); }
  return String(row.id);
}

async function disableUser(repo: AuthRepository, args: CliArgs): Promise<void> {
  if (!args.reference) { console.error('Error: --reference is required'); process.exit(1); }
  const userId = await findUserIdByRef(repo, args.reference);
  await repo.disableUser(userId);
  console.log(JSON.stringify({ reference: args.reference, status: 'disabled' }));
}

async function revokeUserSessions(repo: AuthRepository, args: CliArgs): Promise<void> {
  if (!args.reference) { console.error('Error: --reference is required'); process.exit(1); }
  const userId = await findUserIdByRef(repo, args.reference);
  await repo.revokeUserSessions(userId);
  console.log(JSON.stringify({ reference: args.reference, sessionsRevoked: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unexpected error');
  process.exit(1);
});
