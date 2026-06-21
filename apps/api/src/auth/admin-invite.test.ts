import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminInvitationError,
  createSecondAdminInvitation,
  formatAdminInvitationResult,
  isDisposableAdminEmail,
  normalizeAdminEmail,
} from './admin-invite.js';

function makePool(options: {
  activeUser?: { id: string; role: string; status: string } | null;
  pendingInvitation?: { id: string; public_reference: string; status: string } | null;
} = {}) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (/FROM app_users/i.test(sql)) return { rows: options.activeUser ? [options.activeUser] : [] };
    if (/FROM access_invitations/i.test(sql)) return { rows: options.pendingInvitation ? [options.pendingInvitation] : [] };
    if (/INSERT INTO auth_audit_events/i.test(sql)) return { rows: [] };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { pool: { query }, calls };
}

function makeDeps(options: Parameters<typeof makePool>[0] = {}) {
  const { pool, calls } = makePool(options);
  const invitations = {
    create: vi.fn(async (input: unknown) => ({
      invitation: {
        id: 'invitation-id-1',
        publicReference: 'INV-20260621-ABC123',
        emailNormalized: 'second.admin@example.test',
        expiresAt: '2026-06-23T10:00:00.000Z',
        intendedRole: 'admin' as const,
      },
      token: 'RAW_INVITATION_TOKEN_SHOULD_NOT_LEAK',
      input,
    })),
  };
  const emailProvider = { sendInvitation: vi.fn(async () => undefined) };
  return { pool, calls, invitations, emailProvider };
}

describe('normalizeAdminEmail', () => {
  it('normaliza y valida email real', () => {
    expect(normalizeAdminEmail('  Segundo.Admin+ops@RealDomain.COM  ')).toBe('segundo.admin+ops@realdomain.com');
  });

  it('rechaza formato inválido', () => {
    expect(() => normalizeAdminEmail('not-an-email')).toThrow(AdminInvitationError);
  });

  it('detecta dominios ficticios en producción', () => {
    expect(isDisposableAdminEmail('test@example.com')).toBe(true);
    expect(isDisposableAdminEmail('admin@invalid.local')).toBe(true);
    expect(isDisposableAdminEmail('admin@e2e.realstate.test')).toBe(true);
  });
});

describe('createSecondAdminInvitation', () => {
  it('crea una invitación admin válida, envía email y registra auditoría sin devolver token', async () => {
    const deps = makeDeps();

    const result = await createSecondAdminInvitation({
      email: 'second.admin@example.test',
      dryRun: false,
      nodeEnv: 'test',
      authEmailMode: 'capture',
    }, deps);

    expect(deps.invitations.create).toHaveBeenCalledWith({
      emailNormalized: 'second.admin@example.test',
      intendedRole: 'admin',
    });
    expect(deps.emailProvider.sendInvitation).toHaveBeenCalledWith(
      'second.admin@example.test',
      expect.stringMatching(/^\/acceso\/activar#token=/),
    );
    expect(deps.calls.some(call => /INSERT INTO auth_audit_events/i.test(call.sql) && call.params?.includes('admin_invitation_email_sent'))).toBe(true);
    expect(result).toMatchObject({
      emailNormalized: 'second.admin@example.test',
      publicReference: 'INV-20260621-ABC123',
      intendedRole: 'admin',
      dryRun: false,
      emailSent: true,
    });
    expect(JSON.stringify(result)).not.toContain('RAW_INVITATION_TOKEN_SHOULD_NOT_LEAK');
    expect(JSON.stringify(result)).not.toContain('/acceso/activar#token=');
  });

  it('dry-run valida pero no persiste ni envía email', async () => {
    const deps = makeDeps();

    const result = await createSecondAdminInvitation({
      email: 'second.admin@example.test',
      dryRun: true,
      nodeEnv: 'test',
      authEmailMode: 'capture',
    }, deps);

    expect(deps.invitations.create).not.toHaveBeenCalled();
    expect(deps.emailProvider.sendInvitation).not.toHaveBeenCalled();
    expect(deps.calls.some(call => /INSERT INTO auth_audit_events/i.test(call.sql))).toBe(false);
    expect(result).toMatchObject({ dryRun: true, emailSent: false, publicReference: null });
  });

  it('bloquea un admin activo existente', async () => {
    const deps = makeDeps({ activeUser: { id: 'user-1', role: 'admin', status: 'active' } });

    await expect(createSecondAdminInvitation({
      email: 'admin@real-domain.com',
      dryRun: false,
      nodeEnv: 'production',
      authEmailMode: 'smtp',
    }, deps)).rejects.toMatchObject({ code: 'active_admin_exists' });

    expect(deps.invitations.create).not.toHaveBeenCalled();
  });

  it('bloquea invitaciones pendientes existentes', async () => {
    const deps = makeDeps({ pendingInvitation: { id: 'inv-1', public_reference: 'INV-PENDING', status: 'pending' } });

    await expect(createSecondAdminInvitation({
      email: 'admin@real-domain.com',
      dryRun: false,
      nodeEnv: 'production',
      authEmailMode: 'smtp',
    }, deps)).rejects.toMatchObject({ code: 'pending_invitation_exists' });

    expect(deps.invitations.create).not.toHaveBeenCalled();
  });

  it('no permite admins ficticios en producción', async () => {
    const deps = makeDeps();

    await expect(createSecondAdminInvitation({
      email: 'test@example.com',
      dryRun: false,
      nodeEnv: 'production',
      authEmailMode: 'smtp',
    }, deps)).rejects.toMatchObject({ code: 'disposable_email_not_allowed' });

    expect(deps.invitations.create).not.toHaveBeenCalled();
  });
});

describe('formatAdminInvitationResult', () => {
  it('muestra public_reference y nunca token ni enlace completo', () => {
    const output = formatAdminInvitationResult({
      emailNormalized: 'second.admin@example.test',
      publicReference: 'INV-20260621-ABC123',
      intendedRole: 'admin',
      expiresAt: '2026-06-23T10:00:00.000Z',
      dryRun: false,
      emailSent: true,
      emailMode: 'smtp',
    }, { showPii: false });

    expect(output).toContain('INV-20260621-ABC123');
    expect(output).toContain('admin');
    expect(output).toContain('se***@example.test');
    expect(output).not.toMatch(/token/i);
    expect(output).not.toContain('/acceso/activar');
    expect(output).not.toContain('second.admin@example.test');
  });
});

describe('scripts/auth/invite-admin.sh', () => {
  it('--help funciona sin conectar a base de datos y no muestra material sensible', () => {
    const output = execFileSync('bash', ['../../scripts/auth/invite-admin.sh', '--help'], {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8',
    });

    expect(output).toContain('--email');
    expect(output).toContain('--dry-run');
    expect(output).not.toMatch(/token=[A-Za-z0-9_-]+/);
    expect(output).not.toContain('/acceso/activar#');
  });
});
