import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from './context';
import { resetPassword as resetPasswordApi, AuthDisabledError } from './client';
import { setPageMetadata } from '../metadata';

export function ResetPasswordPage() {
  const { isAuthAvailable, checkedAvailability, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageMetadata('Restablecer contraseña | MILLENNIALS CONSTRUYEN', 'Restablece la contraseña de tu cuenta de MILLENNIALS CONSTRUYEN.');
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Falta el token de restablecimiento. Revisa el enlace que recibiste por email.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordApi(token, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthDisabledError) {
        setError('El restablecimiento de contraseña no está disponible en este momento.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se ha podido restablecer la contraseña.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (authLoading || !checkedAvailability) {
    return (
      <main className="min-h-screen bg-carbon text-textLight" role="status">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
          <p className="mt-4 text-muted">Verificando disponibilidad…</p>
        </div>
      </main>
    );
  }

  // ── Disabled state ──
  if (!isAuthAvailable) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <nav aria-label="breadcrumb" className="text-sm">
            <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Restablecer contraseña</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Restablecer contraseña</h1>
          <div className="mt-8 border border-border bg-petroleum p-6">
            <p className="leading-7 text-textLight">
              El restablecimiento de contraseña no está disponible porque la autenticación todavía no está habilitada.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Missing token ──
  if (!token) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Enlace no válido</h1>
          <div className="mt-8 border border-danger bg-danger/10 p-6 text-left" role="alert">
            <p className="leading-7 text-textLight">
              Falta el token de restablecimiento. Revisa el enlace que recibiste por email o solicita uno nuevo.
            </p>
          </div>
          <Link
            to="/acceso/recuperar"
            className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </main>
    );
  }

  // ── Success state ──
  if (success) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Contraseña restablecida</h1>
          <div className="mt-8 border border-mineral/30 bg-petroleum p-6 text-left">
            <p className="leading-7 text-textLight">
              Tu contraseña ha sido restablecida correctamente. Todas las sesiones activas han sido cerradas por seguridad.
            </p>
          </div>
          <Link
            to="/acceso/login"
            className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  // ── Functional form ──
  return (
    <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <nav aria-label="breadcrumb" className="text-sm">
          <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Restablecer contraseña</span>
        </nav>
        <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Restablecer contraseña</h1>
        <p className="mt-4 leading-7 text-muted">Elige una nueva contraseña para tu cuenta.</p>

        {error ? (
          <div role="alert" className="mt-6 border border-danger bg-danger/10 p-4 text-sm font-semibold text-textLight">
            {error}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="grid gap-1 text-sm text-muted">
            Nueva contraseña
            <input
              ref={passwordRef}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-border bg-carbon p-3 text-textLight placeholder:text-muted focus:border-mineral focus:outline-none focus:ring-1 focus:ring-mineral"
              autoComplete="new-password"
              disabled={submitting}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted">
            Confirmar contraseña
            <input
              name="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border border-border bg-carbon p-3 text-textLight placeholder:text-muted focus:border-mineral focus:outline-none focus:ring-1 focus:ring-mineral"
              autoComplete="new-password"
              disabled={submitting}
              placeholder="Repite la contraseña"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
          >
            {submitting ? 'Restableciendo…' : 'Restablecer contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}
