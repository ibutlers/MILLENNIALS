import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from './context';
import { AuthDisabledError, InvalidCredentialsError, RateLimitedError, AccountDisabledError, TwoFactorRequiredError } from './client';
import { setPageMetadata } from '../metadata';

export function LoginPage() {
  const { login, isAuthenticated, isAuthAvailable, checkedAvailability, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const returnTo = searchParams.get('retorno') || '/inversores';

  useEffect(() => {
    setPageMetadata('Acceso inversores | MILLENNIALS CONSTRUYEN', 'Accede a la zona privada de inversores de MILLENNIALS CONSTRUYEN.');
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Redirect if already authenticated
  useEffect(() => {
    if (checkedAvailability && isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [checkedAvailability, isAuthenticated, navigate, returnTo]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Introduce email y contraseña.');
      return;
    }

    if (!email.includes('@')) {
      setError('Introduce un email válido.');
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        const params = new URLSearchParams({ modo: 'challenge', retorno: returnTo });
        navigate(`/acceso/2fa?${params.toString()}`, { replace: true });
        return;
      }
      if (err instanceof AuthDisabledError) {
        setError('La autenticación no está disponible en este momento.');
      } else if (err instanceof InvalidCredentialsError) {
        setError('Credenciales incorrectas. Revisa tu email y contraseña.');
      } else if (err instanceof RateLimitedError) {
        setError('Demasiados intentos. Inténtalo más tarde.');
      } else if (err instanceof AccountDisabledError) {
        setError('La cuenta está deshabilitada. Contacta con soporte.');
      } else {
        setError('No se ha podido iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading state ──
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

  // ── Auth disabled state ──
  if (!isAuthAvailable) {
    return (
      <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <nav aria-label="breadcrumb" className="text-sm">
            <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Acceso inversores</span>
          </nav>
          <p className="mt-8 inline-block border border-mineral/50 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-mineral">
            Próximamente
          </p>
          <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-7xl">
            Acceso a inversores
          </h1>
          <div className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
            <p className="text-lg leading-8 text-textLight">
              El acceso a inversores estará disponible próximamente.
            </p>
            <p className="mt-4 leading-7 text-muted">
              La zona privada con documentación, cartera y seguimiento de oportunidades está en preparación.
              Mientras tanto, puedes solicitar acceso anticipado o consultar la información pública disponible.
            </p>
            <div className="mt-6 grid gap-3 sm:flex">
              <Link
                to="/coinvierte"
                className="inline-flex items-center justify-center bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
              >
                Coinvierte con nosotros
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

  // ── Functional login form ──
  return (
    <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <nav aria-label="breadcrumb" className="text-sm">
          <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Acceso inversores</span>
        </nav>
        <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Acceso inversores</h1>
        <p className="mt-4 leading-7 text-muted">Introduce tus credenciales para acceder a la zona privada.</p>

        {error ? (
          <div ref={errorRef} tabIndex={-1} role="alert" className="mt-6 border border-danger bg-danger/10 p-4 text-sm font-semibold text-textLight">
            {error}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
          <label htmlFor="login-email" className="grid gap-1 text-sm text-muted">
            Email
            <input
              ref={emailRef}
              id="login-email"
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
          <label htmlFor="login-password" className="grid gap-1 text-sm text-muted">
            Contraseña
            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-border bg-carbon p-3 text-textLight placeholder:text-muted focus:border-mineral focus:outline-none focus:ring-1 focus:ring-mineral"
              autoComplete="current-password"
              disabled={submitting}
              placeholder="••••••••"
            />
          </label>
          <div className="flex justify-end">
            <Link to="/acceso/recuperar" className="text-sm text-muted underline hover:text-mineral">
              ¿Olvidaste la contraseña?
            </Link>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-mineral px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
          >
            {submitting ? 'Accediendo…' : 'Acceder'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="text-mineral underline hover:text-mineralHover">
            Solicitar registro
          </Link>
        </p>
      </div>
    </main>
  );
}
