import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from './context';

/** Loading/skeleton component shown while auth state is being determined */
function AuthGuardLoader() {
  return (
    <main className="min-h-screen bg-carbon text-textLight" role="status" aria-label="Comprobando autenticación">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
        <p className="mt-4 text-muted">Verificando acceso…</p>
      </div>
    </main>
  );
}

/** Redirects to /acceso if not authenticated. Stores return URL. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkedAvailability, isAuthAvailable } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (checkedAvailability && !isAuthAvailable) {
      // Auth is disabled — still allow access to the investor area
      // because the pages themselves handle the disabled state
      return;
    }
    if (!isLoading && checkedAvailability && !isAuthenticated) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/acceso?retorno=${returnTo}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, checkedAvailability, isAuthAvailable, navigate]);

  // Show loading while checking auth status
  if (isLoading || !checkedAvailability) {
    return <AuthGuardLoader />;
  }

  // If auth is disabled, show the content (pages handle disabled state)
  if (!isAuthAvailable) {
    return <>{children}</>;
  }

  // If authenticated, show content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Redirecting — show loader
  return <AuthGuardLoader />;
}

/** Checks that the user has at least one of the required roles. */
export function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, checkedAvailability, isAuthAvailable } = useAuth();

  if (isLoading || !checkedAvailability) {
    return <AuthGuardLoader />;
  }

  if (!isAuthAvailable) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen bg-carbon text-textLight">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-serif text-4xl">Acceso restringido</h1>
          <p className="mt-4 text-muted">Inicia sesión para acceder a esta sección.</p>
        </div>
      </main>
    );
  }

  const hasRole = roles.some((role) => user.roles?.includes(role));
  if (!hasRole) {
    return (
      <main className="min-h-screen bg-carbon text-textLight">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="font-serif text-4xl">Sin permisos</h1>
          <p className="mt-4 text-muted">No tienes permisos para acceder a esta sección.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
