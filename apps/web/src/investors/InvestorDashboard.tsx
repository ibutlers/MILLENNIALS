import { useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/context';
import { setPageMetadata } from '../metadata';

export function InvestorDashboard() {
  const { user, isAuthAvailable, checkedAvailability, isLoading } = useAuth();

  useEffect(() => {
    setPageMetadata('Panel de inversor | MILLENNIALS CONSTRUYEN | CAPITAL', 'Panel principal de la zona privada de inversores de MILLENNIALS CONSTRUYEN | CAPITAL.');
  }, []);

  // ── Loading ──
  if (isLoading || !checkedAvailability) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" role="status">
        <div className="flex items-center gap-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
          <p className="text-muted">Cargando panel…</p>
        </div>
      </div>
    );
  }

  const displayName = user?.name || user?.email?.split('@')[0] || 'Inversor';

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Panel de inversor
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Bienvenido{displayName ? `, ${displayName}` : ''}
      </h1>

      {isAuthAvailable ? (
        <p className="mt-4 text-lg leading-8 text-muted">
          Este es tu espacio privado en MILLENNIALS CONSTRUYEN | CAPITAL. Desde aquí podrás gestionar tu cartera, revisar documentos y seguir el estado de tus inversiones.
        </p>
      ) : (
        <p className="mt-4 text-lg leading-8 text-muted">
          La zona privada para inversores está en preparación. Estamos construyendo las funcionalidades que necesitarás para gestionar tus inversiones.
        </p>
      )}

      {/* ── Upcoming features notice ── */}
      <div className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
        <h2 className="font-serif text-3xl text-textLight">Próximamente</h2>
        <p className="mt-4 leading-8 text-muted">
          Cartera, documentos, KYC — estas funcionalidades llegarán en próximos hitos.
        </p>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
          <li className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 bg-mineral" aria-hidden="true" />
            <span>Cartera con capital comprometido, aportado y distribuciones</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 bg-mineral" aria-hidden="true" />
            <span>Documentación legal y fiscal de cada proyecto</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 bg-mineral" aria-hidden="true" />
            <span>Verificación de identidad (KYC)</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 bg-mineral" aria-hidden="true" />
            <span>Actualizaciones periódicas de hitos y avances</span>
          </li>
        </ul>
      </div>

      {/* ── Quick links ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/inversores/oportunidades"
          className="border border-border bg-carbon p-6 transition hover:border-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
        >
          <h3 className="font-serif text-2xl text-textLight">Oportunidades disponibles</h3>
          <p className="mt-3 leading-7 text-muted">Consulta el catálogo de oportunidades abiertas a inversión.</p>
          <span className="mt-4 inline-block text-sm font-black uppercase tracking-[0.16em] text-mineral">Ver oportunidades →</span>
        </Link>
        <Link
          to="/inversores/cuenta"
          className="border border-border bg-carbon p-6 transition hover:border-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
        >
          <h3 className="font-serif text-2xl text-textLight">Configuración de cuenta</h3>
          <p className="mt-3 leading-7 text-muted">Gestiona tu perfil, sesiones y preferencias de cuenta.</p>
          <span className="mt-4 inline-block text-sm font-black uppercase tracking-[0.16em] text-mineral">Gestionar cuenta →</span>
        </Link>
      </div>
    </div>
  );
}
