import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './context';
import { register as registerApi, AuthDisabledError } from './client';
import { setPageMetadata } from '../metadata';

export function RegisterPage() {
  const { isAuthenticated, isAuthAvailable, checkedAvailability, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageMetadata('Registro | Realstate', 'Solicita acceso a la plataforma de inversión inmobiliaria Realstate.');
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (checkedAvailability && isAuthenticated) {
      navigate('/inversores', { replace: true });
    }
  }, [checkedAvailability, isAuthenticated, navigate]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Introduce tu nombre completo.');
      nameRef.current?.focus();
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Introduce un email válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await registerApi({ name: name.trim(), email: email.trim(), password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthDisabledError) {
        setError('El registro no está disponible en este momento.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se ha podido completar el registro. Inténtalo de nuevo.');
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
        <div className="mx-auto max-w-2xl">
          <nav aria-label="breadcrumb" className="text-sm">
            <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Registro</span>
          </nav>
          <p className="mt-8 inline-block border border-mineral/50 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-mineral">
            Próximamente
          </p>
          <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-7xl">
            Registro de inversores
          </h1>
          <div className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
            <p className="text-lg leading-8 text-textLight">
              El registro de nuevos inversores todavía no está habilitado.
            </p>
            <p className="mt-4 leading-7 text-muted">
              Estamos preparando el proceso de verificación y alta de inversores. Cuando esté disponible,
              podrás crear tu cuenta, verificar tu identidad y acceder a oportunidades de inversión.
            </p>
            <div className="mt-6 grid gap-3 sm:flex">
              <Link
                to="/solicitar-acceso"
                className="inline-flex items-center justify-center bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
              >
                Solicitar acceso anticipado
              </Link>
              <Link
                to="/contacto"
                className="inline-flex items-center justify-center border border-border px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
              >
                Contactar
              </Link>
            </div>
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
          <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Registro enviado</h1>
          <div className="mt-8 border border-mineral/30 bg-petroleum p-6 text-left">
            <p className="leading-7 text-textLight">
              Hemos recibido tu solicitud de registro. Revisa tu correo electrónico para verificar tu dirección.
            </p>
            <p className="mt-4 text-sm text-muted">
              Si no encuentras el email, revisa la carpeta de spam o correo no deseado.
            </p>
          </div>
          <Link
            to="/acceso"
            className="mt-6 inline-flex bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
          >
            Ir al acceso
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
          <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Registro</span>
        </nav>
        <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Registro</h1>
        <p className="mt-4 leading-7 text-muted">Crea tu cuenta para acceder a la zona de inversores.</p>

        {error ? (
          <div ref={errorRef} tabIndex={-1} role="alert" className="mt-6 border border-danger bg-danger/10 p-4 text-sm font-semibold text-textLight">
            {error}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="grid gap-1 text-sm text-muted">
            Nombre completo
            <input
              ref={nameRef}
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-border bg-carbon p-3 text-textLight placeholder:text-muted focus:border-mineral focus:outline-none focus:ring-1 focus:ring-mineral"
              autoComplete="name"
              disabled={submitting}
              placeholder="Tu nombre"
            />
          </label>
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
          <label className="grid gap-1 text-sm text-muted">
            Contraseña
            <input
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
          <button
            type="submit"
            disabled={submitting}
            className="bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
          >
            {submitting ? 'Registrando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{' '}
          <Link to="/acceso" className="text-mineral underline hover:text-mineralHover">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
