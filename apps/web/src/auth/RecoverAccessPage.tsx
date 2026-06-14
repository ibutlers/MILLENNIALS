import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from './context';
import { forgotPassword as forgotPasswordApi, AuthDisabledError } from './client';
import { setPageMetadata } from '../metadata';

export function RecoverAccessPage() {
  const { isAuthAvailable, checkedAvailability, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageMetadata('Recuperar acceso | Realstate', 'Recupera el acceso a tu cuenta de Realstate.');
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !email.includes('@')) {
      setError('Introduce un email válido.');
      return;
    }

    setSubmitting(true);
    try {
      await forgotPasswordApi(email.trim());
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthDisabledError) {
        setError('La recuperación de acceso no está disponible en este momento.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se ha podido procesar la solicitud.');
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
            <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Recuperar acceso</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Recuperar acceso</h1>
          <div className="mt-8 border border-border bg-petroleum p-6">
            <p className="leading-7 text-textLight">
              La recuperación de acceso no está disponible porque el sistema de autenticación todavía no está habilitado.
            </p>
            <p className="mt-4 text-muted">
              Cuando la plataforma esté operativa, podrás restablecer tu contraseña desde esta página.
            </p>
            <Link
              to="/contacto"
              className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
            >
              Contactar
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Success state ──
  if (success) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Solicitud enviada</h1>
          <div className="mt-8 border border-mineral/30 bg-petroleum p-6 text-left">
            <p className="leading-7 text-textLight">
              Si la cuenta existe, recibirás instrucciones para restablecer la contraseña en tu correo electrónico.
            </p>
            <p className="mt-4 text-sm text-muted">
              Revisa también la carpeta de spam si no encuentras el mensaje.
            </p>
          </div>
          <Link
            to="/acceso"
            className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
          >
            Volver al acceso
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
          <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Recuperar acceso</span>
        </nav>
        <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Recuperar acceso</h1>
        <p className="mt-4 leading-7 text-muted">
          Introduce tu email y te enviaremos instrucciones para restablecer la contraseña.
        </p>

        {error ? (
          <div role="alert" className="mt-6 border border-danger bg-danger/10 p-4 text-sm font-semibold text-textLight">
            {error}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="grid gap-1 text-sm text-muted">
            Email
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-border bg-carbon p-3 text-textLight placeholder:text-muted focus:border-mineral focus:outline-none focus:ring-1 focus:ring-mineral"
              autoComplete="email"
              disabled={submitting}
              placeholder="tu@email.com"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
          >
            {submitting ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/acceso" className="text-mineral underline hover:text-mineralHover">
            Volver al acceso
          </Link>
        </p>
      </div>
    </main>
  );
}
