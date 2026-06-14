import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { verifyEmail as verifyEmailApi, AuthDisabledError } from './client';
import { setPageMetadata } from '../metadata';

type State =
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string }
  | { status: 'disabled' };

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    setPageMetadata('Verificar email | Realstate', 'Verifica tu dirección de correo electrónico en Realstate.');
  }, []);

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'Falta el token de verificación. Revisa el enlace que recibiste por email.' });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function verify() {
      try {
        await verifyEmailApi(token!, controller.signal);
        if (!cancelled) setState({ status: 'success' });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthDisabledError) {
          setState({ status: 'disabled' });
        } else if (err instanceof Error) {
          setState({ status: 'error', message: err.message });
        } else {
          setState({ status: 'error', message: 'No se ha podido verificar el email.' });
        }
      }
    }

    verify();
    return () => { cancelled = true; controller.abort(); };
  }, [token]);

  return (
    <main className="min-h-screen bg-carbon px-4 py-10 text-textLight sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <nav aria-label="breadcrumb" className="text-sm">
          <Link to="/" className="underline hover:text-mineral">Inicio</Link> / <span>Verificar email</span>
        </nav>
        <h1 className="mt-6 font-serif text-5xl leading-[0.95] tracking-[-0.04em]">Verificar email</h1>

        {state.status === 'loading' ? (
          <div className="mt-8 flex items-center gap-4" role="status">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
            <p className="text-muted">Verificando tu dirección de correo…</p>
          </div>
        ) : null}

        {state.status === 'disabled' ? (
          <div className="mt-8 border border-border bg-petroleum p-6">
            <p className="leading-7 text-textLight">
              La verificación de email no está disponible en este momento.
            </p>
            <p className="mt-4 text-muted">
              La plataforma está en fase de preparación. La verificación estará disponible cuando el registro se habilite.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
            >
              Volver al inicio
            </Link>
          </div>
        ) : null}

        {state.status === 'success' ? (
          <div className="mt-8 border border-mineral/30 bg-petroleum p-6">
            <p className="text-lg font-semibold text-textLight">Email verificado</p>
            <p className="mt-3 leading-7 text-muted">
              Tu dirección de correo ha sido verificada correctamente. Ya puedes acceder a tu cuenta.
            </p>
            <Link
              to="/acceso"
              className="mt-6 inline-flex bg-mineral px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
            >
              Iniciar sesión
            </Link>
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="mt-8 border border-danger bg-danger/10 p-6" role="alert">
            <p className="font-semibold text-textLight">Error de verificación</p>
            <p className="mt-2 leading-7 text-muted">{state.message}</p>
            <Link
              to="/acceso"
              className="mt-6 inline-flex border border-border px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
            >
              Volver al acceso
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
