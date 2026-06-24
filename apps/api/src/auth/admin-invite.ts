import type { AuthEmailProvider } from './email-provider.js';

export type AdminInviteEmailMode = 'disabled' | 'capture' | 'smtp' | string;

export class AdminInvitationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AdminInvitationError';
    this.code = code;
  }
}

export interface AdminInvitationInput {
  email: string;
  dryRun: boolean;
  nodeEnv: string;
  authEmailMode: AdminInviteEmailMode;
}

export interface AdminInvitationResult {
  emailNormalized: string;
  publicReference: string | null;
  intendedRole: 'admin';
  expiresAt: string | null;
  dryRun: boolean;
  emailSent: boolean;
  emailMode: AdminInviteEmailMode;
}

export interface QueryablePool {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface AdminInvitationDependencies {
  pool: QueryablePool;
  invitations: {
    create(input: { emailNormalized: string; intendedRole: 'admin' }): Promise<{
      invitation: {
        id: string;
        publicReference: string;
        emailNormalized: string;
        intendedRole: 'admin' | 'investor' | 'operator';
        expiresAt: string;
      };
      token: string;
    }>;
  };
  emailProvider: Pick<AuthEmailProvider, 'sendInvitation'>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'test.com',
  'invalid.local',
  'localhost',
  'e2e.realstate.test',
]);

export function normalizeAdminEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) {
    throw new AdminInvitationError('invalid_email', 'Email inválido.');
  }
  return normalized;
}

export function isDisposableAdminEmail(email: string): boolean {
  const normalized = normalizeAdminEmail(email);
  const domain = normalized.split('@')[1] || '';
  return DISPOSABLE_DOMAINS.has(domain)
    || domain.endsWith('.test')
    || domain.endsWith('.invalid')
    || domain.endsWith('.example');
}

export function maskAdminEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = Math.min(2, local.length);
  return `${local.slice(0, visible)}***@${domain}`;
}

function shouldSendEmail(mode: AdminInviteEmailMode): boolean {
  return mode === 'smtp' || mode === 'capture';
}

async function assertCanInviteAdmin(pool: QueryablePool, emailNormalized: string): Promise<void> {
  const activeUser = await pool.query(
    `SELECT id, role, status
     FROM app_users
     WHERE email_normalized = $1 AND status = 'active'
     LIMIT 1`,
    [emailNormalized],
  );

  if (activeUser.rows.length > 0) {
    const role = String(activeUser.rows[0].role || '');
    throw new AdminInvitationError(
      role === 'admin' ? 'active_admin_exists' : 'active_user_exists',
      role === 'admin'
        ? 'Ya existe un administrador activo con ese email.'
        : 'Ya existe un usuario activo con ese email.',
    );
  }

  const pendingInvitation = await pool.query(
    `SELECT id, public_reference, status
     FROM access_invitations
     WHERE email_normalized = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [emailNormalized],
  );

  if (pendingInvitation.rows.length > 0) {
    throw new AdminInvitationError(
      'pending_invitation_exists',
      'Ya existe una invitación pendiente para ese email.',
    );
  }
}

async function auditAdminInvitationEmailSent(pool: QueryablePool, params: {
  invitationId: string;
  emailNormalized: string;
  publicReference: string;
  emailMode: AdminInviteEmailMode;
}): Promise<void> {
  await pool.query(
    `INSERT INTO auth_audit_events (action, resource_type, resource_id, result, metadata)
     VALUES ($1, 'access_invitation', $2, 'success', $3::jsonb)`,
    [
      'admin_invitation_email_sent',
      params.invitationId,
      JSON.stringify({
        email: params.emailNormalized,
        public_reference: params.publicReference,
        intended_role: 'admin',
        email_mode: params.emailMode,
      }),
    ],
  );
}

export async function createSecondAdminInvitation(
  input: AdminInvitationInput,
  deps: AdminInvitationDependencies,
): Promise<AdminInvitationResult> {
  const emailNormalized = normalizeAdminEmail(input.email);

  if (input.nodeEnv !== 'test' && isDisposableAdminEmail(emailNormalized)) {
    throw new AdminInvitationError(
      'disposable_email_not_allowed',
      'No se permiten emails ficticios para un administrador real.',
    );
  }

  await assertCanInviteAdmin(deps.pool, emailNormalized);

  if (input.dryRun) {
    return {
      emailNormalized,
      publicReference: null,
      intendedRole: 'admin',
      expiresAt: null,
      dryRun: true,
      emailSent: false,
      emailMode: input.authEmailMode,
    };
  }

  const { invitation, token } = await deps.invitations.create({
    emailNormalized,
    intendedRole: 'admin',
  });

  let emailSent = false;
  if (shouldSendEmail(input.authEmailMode)) {
    await deps.emailProvider.sendInvitation(emailNormalized, `/acceso/activar#token=${token}`);
    emailSent = true;
    await auditAdminInvitationEmailSent(deps.pool, {
      invitationId: invitation.id,
      emailNormalized,
      publicReference: invitation.publicReference,
      emailMode: input.authEmailMode,
    });
  }

  return {
    emailNormalized,
    publicReference: invitation.publicReference,
    intendedRole: 'admin',
    expiresAt: invitation.expiresAt,
    dryRun: false,
    emailSent,
    emailMode: input.authEmailMode,
  };
}

export function formatAdminInvitationResult(
  result: AdminInvitationResult,
  options: { showPii: boolean },
): string {
  const email = options.showPii ? result.emailNormalized : maskAdminEmail(result.emailNormalized);
  if (result.dryRun) {
    return [
      'DRY-RUN OK: no se ha creado ninguna invitación.',
      `  Email: ${email}`,
      '  Rol: admin',
      `  Envío email: ${result.emailMode === 'disabled' ? 'no configurado' : 'se enviaría por el proveedor configurado'}`,
    ].join('\n');
  }

  return [
    `✓ Invitación admin creada: ${result.publicReference}`,
    `  Email: ${email}`,
    '  Rol: admin',
    `  Expira: ${result.expiresAt}`,
    `  Correo enviado: ${result.emailSent ? 'sí' : 'no (proveedor no SMTP/capture)'}`,
  ].join('\n');
}
