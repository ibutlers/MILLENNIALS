import { useEffect, useMemo, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from './context';

type SetupState = 'password' | 'verify' | 'backup' | 'done';

function extractError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const body = payload as { error?: { message?: unknown }; message?: unknown };
    if (typeof body.error?.message === 'string') return body.error.message;
    if (typeof body.message === 'string') return body.message;
  }
  return fallback;
}

async function readJson(resp: Response): Promise<unknown> {
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return resp.json().catch(() => null);
}

function unwrapTotpUri(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const body = payload as { totpURI?: unknown; data?: { totpURI?: unknown } };
  return typeof body.totpURI === 'string'
    ? body.totpURI
    : typeof body.data?.totpURI === 'string'
      ? body.data.totpURI
      : '';
}

function unwrapBackupCodes(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const body = payload as { backupCodes?: unknown; data?: { backupCodes?: unknown } };
  const raw = Array.isArray(body.backupCodes) ? body.backupCodes : Array.isArray(body.data?.backupCodes) ? body.data?.backupCodes : [];
  return raw.filter((code): code is string => typeof code === 'string' && code.length > 0);
}

function extractManualSecret(totpUri: string): string {
  try {
    const url = new URL(totpUri);
    return url.searchParams.get('secret') || '';
  } catch {
    return '';
  }
}

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/inversores';
  if (value.startsWith('/acceso/login') || value.startsWith('/acceso/2fa')) return '/inversores';
  return value;
}

/**
 * TwoFactorPage — configuración opcional de TOTP y challenge para cuentas que ya lo activaron.
 */
export function TwoFactorPage() {
  const { isAuthAvailable, checkedAvailability, isAuthenticated, user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isChallenge = searchParams.get('modo') === 'challenge';
  const returnTo = sanitizeReturnTo(searchParams.get('retorno'));
  const [step, setStep] = useState<SetupState>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesSaved, setCodesSaved] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const manualSecret = useMemo(() => extractManualSecret(totpUri), [totpUri]);

  useEffect(() => {
    refreshSession().catch(() => {});
  }, [refreshSession]);

  if (checkedAvailability && !isAuthAvailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Verificación no disponible</h1>
          <p className="mt-4 text-charcoal">La verificación en dos pasos no está disponible en este momento.</p>
        </div>
      </main>
    );
  }

  if (checkedAvailability && !isChallenge && !isAuthenticated && !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Vuelve a iniciar sesión</h1>
          <p className="mt-4 text-charcoal">
            Esta página permite configurar seguridad adicional opcional. Inicia sesión con la misma cuenta y volverás a la configuración.
          </p>
          <button
            type="button"
            onClick={() => navigate('/acceso/login?retorno=/acceso/2fa')}
            className="mt-6 w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white hover:bg-electric-hover"
          >
            Iniciar sesión para configurar seguridad adicional
          </button>
        </div>
      </main>
    );
  }

  async function verifyTotpCode(fallback: string): Promise<void> {
    const verifyResp = await fetch('/api/auth/two-factor/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    const verifyPayload = await readJson(verifyResp);
    if (!verifyResp.ok) throw new Error(extractError(verifyPayload, fallback));
  }

  async function reconcileMfa(): Promise<void> {
    const reconcileResp = await fetch('/api/auth/reconcile-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const reconcilePayload = await readJson(reconcileResp);
    if (!reconcileResp.ok) throw new Error(extractError(reconcilePayload, 'No hemos podido activar tu acceso tras 2FA.'));
  }

  function validateCode(): boolean {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Introduce un código de 6 dígitos válido.');
      return false;
    }
    return true;
  }

  async function handleEnable(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Introduce la contraseña de tu cuenta para configurar 2FA.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch('/api/auth/two-factor/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, issuer: 'MILLENNIALS CONSTRUYEN' }),
      });
      const payload = await readJson(resp);
      if (resp.status === 401) {
        throw new Error('Tu sesión no está activa. Inicia sesión de nuevo para configurar 2FA.');
      }
      if (!resp.ok) throw new Error(extractError(payload, 'No hemos podido iniciar la configuración 2FA.'));
      const uri = unwrapTotpUri(payload);
      if (!uri) throw new Error('No hemos podido generar la clave TOTP. Inténtalo de nuevo.');
      setTotpUri(uri);
      setQrDataUrl(await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 }));
      setBackupCodes(unwrapBackupCodes(payload));
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hemos podido iniciar la configuración 2FA.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChallenge(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateCode()) return;
    setSubmitting(true);
    try {
      await verifyTotpCode('Código inválido o expirado.');
      await refreshSession().catch(() => {});
      await reconcileMfa().catch(() => undefined);
      await refreshSession().catch(() => {});
      window.location.assign(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validateCode()) return;
    setSubmitting(true);
    try {
      await verifyTotpCode('Código inválido o expirado.');
      await reconcileMfa();
      await refreshSession().catch(() => {});
      setStep(backupCodes.length > 0 ? 'backup' : 'done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    setCodesSaved(true);
    setStep('done');
    setTimeout(() => navigate(returnTo, { replace: true }), 900);
  }

  if (isChallenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Verifica tu acceso</h1>
          <p className="mt-2 text-sm text-charcoal">
            Esta cuenta ya tiene verificación en dos pasos. Introduce el código de tu aplicación autenticadora para completar el inicio de sesión.
          </p>
          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleChallenge} className="mt-6 space-y-4">
            <div>
              <label htmlFor="totp-challenge-code" className="block text-sm font-medium text-charcoal">Código de verificación</label>
              <input
                id="totp-challenge-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                minLength={6}
                required
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 block w-full rounded-lg border border-frost px-3 py-3 text-center text-2xl tracking-widest text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white transition-colors hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Verificando…' : 'Completar inicio de sesión'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (step === 'done') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">¡Seguridad adicional configurada!</h1>
          <p className="mt-4 text-charcoal">Redirigiendo a tu zona privada…</p>
        </div>
      </main>
    );
  }

  if (step === 'backup') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Códigos de recuperación</h1>
          <p className="mt-2 text-sm text-charcoal">
            Guarda estos códigos en un lugar seguro. Cada código solo puede usarse una vez. No los compartas con nadie.
          </p>
          <div className="mt-4 rounded-lg bg-gray-50 p-4 font-mono text-sm">
            {backupCodes.map((backupCode) => (
              <div key={backupCode} className="py-1 text-charcoal">{backupCode}</div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(backupCodes.join('\n')).catch(() => {})}
            className="mt-4 w-full rounded-lg border border-frost px-4 py-2 text-sm text-charcoal hover:bg-gray-50"
          >
            Copiar al portapapeles
          </button>
          <button
            type="button"
            disabled={!codesSaved && backupCodes.length === 0}
            onClick={finish}
            className="mt-3 w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white hover:bg-electric-hover"
          >
            He guardado los códigos — Continuar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
      <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Configurar seguridad adicional</h1>
        <p className="mt-2 text-sm text-charcoal">
          {step === 'password'
            ? 'Este paso opcional activa TOTP por primera vez. Si ya lo activaste, inicia sesión para ver el challenge de acceso.'
            : 'Añade esta clave en tu aplicación de autenticación y escribe el código de 6 dígitos.'}
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'password' ? (
          <form onSubmit={handleEnable} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-charcoal">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-frost px-3 py-3 text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || password.length < 8}
              className="w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white transition-colors hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Generando…' : 'Generar clave de seguridad'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            {qrDataUrl ? (
              <div className="rounded-lg border border-frost bg-white p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal">Código QR</p>
                <img
                  src={qrDataUrl}
                  alt="Código QR para configurar la verificación en dos pasos"
                  className="mx-auto mt-3 h-60 w-60"
                />
              </div>
            ) : null}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal">Clave manual</p>
              <p className="mt-2 break-all font-mono text-sm text-ink">{manualSecret || totpUri}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(manualSecret || totpUri).catch(() => {})}
                className="mt-3 rounded-lg border border-frost px-3 py-2 text-sm text-charcoal hover:bg-white"
              >
                Copiar clave
              </button>
            </div>
            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-charcoal">Código de verificación</label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                minLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 block w-full rounded-lg border border-frost px-3 py-3 text-center text-2xl tracking-widest text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                placeholder="000000"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white transition-colors hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Verificando…' : 'Verificar y activar seguridad adicional'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
