import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useAuth } from './context';
/**
 * ActivationPage — invitation-based account activation.
 *
 * Reads the invitation token from the URL fragment (#token=...),
 * validates it, and allows the user to set their name and password.
 * The email is pre-filled from the validated invitation and is non-editable.
 *
 * The token is removed from the URL immediately after reading (never persisted).
 */
export function ActivationPage() {
  const { signUp, isAuthAvailable, checkedAvailability, isLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationRole, setInvitationRole] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  // Read token from URL fragment on mount
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const rawToken = params.get('token');
    if (rawToken) {
      setToken(rawToken);
      // Remove token from URL immediately
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      setValidating(false);
    }
    setPageMetadata({ title: 'Activar cuenta — MILLENNIALS CONSTRUYEN' });
  }, []);

  // Validate invitation
  useEffect(() => {
    if (!token || !isAuthAvailable) { setValidating(false); return; }
    const validate = async () => {
      try {
        const resp = await fetch('/api/v1/invitations/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email: '' }), // email validated server-side from token
        });
        const data = await resp.json();
        if (data.data?.valid) {
          setInvitationEmail(data.data.email || '');
          setInvitationRole(data.data.intendedRole || 'investor');
        } else {
          setError('La invitación no es válida, ha expirado o ya ha sido utilizada.');
        }
      } catch {
        setError('No se ha podido verificar la invitación. Inténtalo de nuevo.');
      } finally {
        setValidating(false);
        setTimeout(() => nameRef.current?.focus(), 100);
      }
    };
    validate();
  }, [token, isAuthAvailable]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (password.length < 12) { setError('La contraseña debe tener al menos 12 caracteres.'); return; }
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!token) { setError('Token de invitación no disponible.'); return; }

    setSubmitting(true);
    try {
      await signUp(invitationEmail, password, name.trim(), token);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido activar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  }

  // Auth not available
  if (checkedAvailability && !isAuthAvailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Activación no disponible</h1>
          <p className="mt-4 text-charcoal">La activación de cuentas no está disponible en este momento.</p>
          <p className="mt-2 text-sm text-charcoal">Si tienes una invitación, contacta con el equipo.</p>
        </div>
      </main>
    );
  }

  // Loading
  if (validating || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="status">
        <div className="text-charcoal">Verificando invitación…</div>
      </main>
    );
  }

  // No token
  if (!token && !validating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">Enlace no válido</h1>
          <p className="mt-4 text-charcoal">El enlace de activación no es válido o está incompleto.</p>
          <p className="mt-2 text-sm text-charcoal">Asegúrate de usar el enlace completo que recibiste por correo.</p>
        </div>
      </main>
    );
  }

  // Success
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
        <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-ink">¡Cuenta creada!</h1>
          <p className="mt-4 text-charcoal">Tu cuenta ha sido creada correctamente.</p>
          <p className="mt-2 text-charcoal">Revisa tu correo para verificar tu dirección de email.</p>
          <p className="mt-4 text-sm text-charcoal">Después de verificar tu email, deberás configurar la verificación en dos pasos (2FA).</p>
        </div>
      </main>
    );
  }

  // Form
  return (
    <main className="flex min-h-screen items-center justify-center bg-lavender p-8" role="main">
      <div className="w-full max-w-md rounded-xl border border-frost bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Activar cuenta</h1>
        <p className="mt-2 text-sm text-charcoal">
          Completa tus datos para activar tu acceso como <strong>{invitationRole}</strong>.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-charcoal">Email</label>
            <input
              id="email" type="email" value={invitationEmail} readOnly
              className="mt-1 block w-full rounded-lg border border-frost bg-gray-50 px-3 py-2 text-charcoal focus:outline-none"
              aria-label="Dirección de correo electrónico (no editable)"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-charcoal">Nombre completo</label>
            <input
              ref={nameRef} id="name" type="text" required minLength={1} maxLength={100}
              value={name} onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-frost px-3 py-2 text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              placeholder="Tu nombre completo"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-charcoal">Contraseña</label>
            <input
              id="password" type="password" required minLength={12} maxLength={128}
              value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-frost px-3 py-2 text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              placeholder="Mínimo 12 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-charcoal">Confirmar contraseña</label>
            <input
              id="confirm-password" type="password" required minLength={12}
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-frost px-3 py-2 text-ink focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              placeholder="Repite la contraseña"
            />
          </div>

          <button
            type="submit" disabled={submitting}
            className="w-full rounded-lg bg-electric px-4 py-3 font-semibold text-white transition-colors hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Activando…' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </main>
  );
}

function setPageMetadata(_meta: { title: string }) {
  if (typeof document !== 'undefined') {
    document.title = _meta.title;
  }
}
