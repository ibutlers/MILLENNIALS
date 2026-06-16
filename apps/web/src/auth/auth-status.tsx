import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { checkAuthAvailable } from './client';
import { useAuth } from './context';

type AuthStatus = 'loading' | 'disabled' | 'enabled_guest' | 'enabled_authenticated';

/** Simple status indicator that checks if auth is available.
 *  Renders contextual links based on auth state. */
export function AuthStatus() {
  const { isAuthenticated, isAuthAvailable } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isAuthAvailable !== null) {
      setChecked(true);
      return;
    }

    const controller = new AbortController();
    checkAuthAvailable(controller.signal)
      .then(() => setChecked(true))
      .catch(() => setChecked(true));

    return () => controller.abort();
  }, [isAuthAvailable]);

  // Determine display state
  let status: AuthStatus = 'loading';
  if (checked || isAuthAvailable !== null) {
    if (isAuthAvailable === false) {
      status = 'disabled';
    } else if (isAuthenticated) {
      status = 'enabled_authenticated';
    } else {
      status = 'enabled_guest';
    }
  }

  return (
    <div className="border border-border bg-petroleum p-5 text-textLight">
      {status === 'loading' ? (
        <div className="flex items-center gap-3" role="status">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
          <span className="text-sm text-muted">Verificando acceso…</span>
        </div>
      ) : null}

      {status === 'disabled' ? (
        <div>
          <p className="text-sm font-semibold text-textLight">
            El acceso a inversores estará disponible próximamente.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Estamos preparando la zona privada. Si quieres que te avisemos, solicita acceso anticipado o contacta con nosotros.
          </p>
          <div className="mt-3 flex gap-3">
            <Link to="/coinvierte" className="text-xs font-bold uppercase tracking-[0.14em] text-mineral underline hover:text-mineralHover">
              Coinvierte con nosotros
            </Link>
            <Link to="/contacto" className="text-xs font-bold uppercase tracking-[0.14em] text-muted underline hover:text-mineral">
              Contactar
            </Link>
          </div>
        </div>
      ) : null}

      {status === 'enabled_guest' ? (
        <div>
          <p className="text-sm text-textLight">La zona de inversores está disponible.</p>
          <Link to="/acceso" className="mt-2 inline-block text-xs font-bold uppercase tracking-[0.14em] text-mineral underline hover:text-mineralHover">
            Iniciar sesión
          </Link>
        </div>
      ) : null}

      {status === 'enabled_authenticated' ? (
        <div>
          <p className="text-sm text-textLight">Has iniciado sesión.</p>
          <Link to="/inversores" className="mt-2 inline-block text-xs font-bold uppercase tracking-[0.14em] text-mineral underline hover:text-mineralHover">
            Ir al panel
          </Link>
        </div>
      ) : null}
    </div>
  );
}
