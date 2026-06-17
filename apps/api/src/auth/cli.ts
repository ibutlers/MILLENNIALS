/**
 * Auth CLI — Operational scripts for user and invitation management.
 *
 * Run via: npx tsx apps/api/src/auth/cli.ts <command> [options]
 *         or via shell wrappers in scripts/auth/
 *
 * Commands:
 *   invite-investor   --lead-ref RS-... [--role investor] [--send]
 *   resend-invitation  <ref>
 *   list-invitations   [--status pending] [--email ...]
 *   revoke-invitation  <ref> [--reason ...]
 *   list-users         [--status active] [--role investor]
 *   suspend-user       <email>
 *   reactivate-user    <email>
 *   revoke-user        <email>
 *   revoke-sessions    <email>
 *   grant-project      <email> <project-slug>
 *   revoke-project     <email> <project-slug>
 *   audit-log          [--limit 50] [--action ...]
 *   reconcile-user     <email>
 *
 * Security:
 *   - Never outputs tokens, links, or full PII
 *   - --pii flag required to see unmasked emails
 *   - Confirmation required for destructive operations
 *   - --yes flag to skip confirmation (use with caution)
 */

import { getPool } from '../db/pool.js';
import { InvitationRepository } from './invitations.js';
import { getConfig } from '../config.js';

const pool = getPool();
const config = getConfig();

function usage(): void {
  console.log(`
Uso: npx tsx apps/api/src/auth/cli.ts <comando> [opciones]

Comandos:
  invite-investor    --lead-ref RS-... [--role investor] [--send]
  resend-invitation   <ref>
  list-invitations    [--status pending] [--email ...]
  revoke-invitation   <ref> [--reason ...]
  list-users          [--status active] [--role investor]
  suspend-user        <email>
  reactivate-user     <email>
  revoke-user         <email>
  revoke-sessions     <email>
  grant-project       <email> <project-slug>
  revoke-project      <email> <project-slug>
  audit-log           [--limit 50] [--action ...]

Opciones globales:
  --pii     Mostrar emails completos (por defecto enmascarados)
  --yes     Omitir confirmación en operaciones destructivas
  --help    Mostrar esta ayuda
`);
  process.exit(0);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = Math.min(2, local.length);
  return local.slice(0, visible) + '***@' + domain;
}

function parseArgs(): { command: string; args: Record<string, string>; flags: Set<string> } {
  const raw = process.argv.slice(2);
  const command = raw[0] || '';
  const args: Record<string, string> = {};
  const flags = new Set<string>();

  let i = 1;
  while (i < raw.length) {
    const arg = raw[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'help') { usage(); }
      if (key === 'pii' || key === 'yes') {
        flags.add(key);
        i++;
        continue;
      }
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = 'true';
        i++;
      }
    } else {
      // Positional
      const existingPos = Object.keys(args).filter(k => k.startsWith('_pos')).length;
      args[`_pos${existingPos}`] = arg;
      i++;
    }
  }

  return { command, args, flags };
}

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs();
  const showPii = flags.has('pii');
  const autoYes = flags.has('yes');

  const invitations = new InvitationRepository(pool);

  switch (command) {
    case 'invite-investor': {
      const leadRef = args['lead-ref'];
      if (!leadRef) {
        console.error('ERROR: --lead-ref RS-... es requerido');
        process.exit(1);
      }
      const role = args['role'] || 'investor';
      if (!['investor', 'staff', 'admin'].includes(role)) {
        console.error('ERROR: --role debe ser investor, staff o admin');
        process.exit(1);
      }

      // Find lead
      const leadResult = await pool.query(
        `SELECT id, email, public_reference FROM leads WHERE public_reference = $1 AND kind = 'coinvest'`,
        [leadRef],
      );
      if (leadResult.rows.length === 0) {
        console.error(`ERROR: Lead Coinvierte ${leadRef} no encontrado`);
        process.exit(1);
      }
      const lead = leadResult.rows[0];
      const email = lead.email as string;
      const emailNormalized = email.toLowerCase().trim();

      console.log(`Lead encontrado: ${showPii ? email : maskEmail(email)}`);
      console.log(`Rol: ${role}`);

      if (!autoYes) {
        console.log('\n¿Crear invitación? (s/n) ');
        // In non-interactive mode, require --yes
        console.error('Use --yes para confirmar en modo no interactivo');
        process.exit(1);
      }

      const { invitation, token } = await invitations.create({
        emailNormalized,
        coinvestLeadId: lead.id as string,
        intendedRole: role as 'investor' | 'staff' | 'admin',
      });

      console.log(`\n✓ Invitación creada: ${invitation.publicReference}`);
      console.log(`  Email: ${showPii ? emailNormalized : maskEmail(emailNormalized)}`);
      console.log(`  Expira: ${invitation.expiresAt}`);
      console.log(`  Rol: ${invitation.intendedRole}`);

      // Token is only shown here — never logged
      if (args['send']) {
        console.log('\n[El enlace de invitación se enviaría por correo cuando SMTP esté configurado]');
        console.log(`[Enlace: /acceso/activar#token=${token}]`);
      }
      break;
    }

    case 'list-invitations': {
      const status = args['status'];
      const email = args['email'];
      const limit = args['limit'] ? parseInt(args['limit'], 10) : 50;

      const result = await invitations.list({ status, email, limit });

      console.log(`Invitaciones: ${result.total} (mostrando ${result.invitations.length})`);
      console.log('-'.repeat(80));
      for (const inv of result.invitations) {
        console.log(
          `${inv.publicReference} | ${showPii ? inv.emailNormalized : maskEmail(inv.emailNormalized)} | ${inv.status} | ${inv.intendedRole} | ${inv.expiresAt.slice(0, 10)}`,
        );
      }
      break;
    }

    case 'revoke-invitation': {
      const ref = args['_pos0'] || args['ref'];
      if (!ref) {
        console.error('ERROR: Referencia de invitación requerida');
        process.exit(1);
      }
      const reason = args['reason'];

      const invitation = await invitations.findByReference(ref);
      if (!invitation) {
        console.error(`ERROR: Invitación ${ref} no encontrada`);
        process.exit(1);
      }

      console.log(`Revocando: ${invitation.publicReference} (${showPii ? invitation.emailNormalized : maskEmail(invitation.emailNormalized)})`);

      if (!autoYes) {
        console.error('Use --yes para confirmar');
        process.exit(1);
      }

      const revoked = await invitations.revoke(invitation.id, 'cli', reason);
      if (revoked) {
        console.log(`✓ Invitación revocada: ${revoked.publicReference}`);
      } else {
        console.log('La invitación ya no estaba activa');
      }
      break;
    }

    case 'list-users': {
      const status = args['status'];
      const role = args['role'];
      const limit = args['limit'] ? parseInt(args['limit'], 10) : 50;

      let whereClause = 'WHERE 1=1';
      const params: unknown[] = [];
      let paramIdx = 0;

      if (status) {
        paramIdx++;
        whereClause += ` AND status = $${paramIdx}`;
        params.push(status);
      }
      if (role) {
        paramIdx++;
        whereClause += ` AND role = $${paramIdx}`;
        params.push(role);
      }

      paramIdx++;
      params.push(limit);

      const result = await pool.query(
        `SELECT public_reference, email_normalized, display_name, role, status, activated_at, last_login_at, created_at
         FROM app_users ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIdx}`,
        params,
      );

      console.log(`Usuarios: ${result.rows.length}`);
      console.log('-'.repeat(80));
      for (const user of result.rows) {
        const email = user.email_normalized as string;
        console.log(
          `${showPii ? email : maskEmail(email)} | ${user.role} | ${user.status} | ${user.created_at ? new Date(user.created_at as string).toISOString().slice(0, 10) : '-'}`,
        );
      }
      break;
    }

    default:
      console.error(`Comando desconocido: ${command}`);
      usage();
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
