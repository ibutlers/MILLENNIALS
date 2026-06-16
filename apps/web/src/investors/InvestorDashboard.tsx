import { useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/context';
import { setPageMetadata } from '../metadata';

export function InvestorDashboard() {
  const { user, isAuthAvailable, checkedAvailability, isLoading } = useAuth();

  useEffect(() => {
    setPageMetadata('Panel de inversor | MILLENNIALS CONSTRUYEN', 'Panel principal de la zona privada de inversores de MILLENNIALS CONSTRUYEN.');
  }, []);

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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 overflow-hidden w-full">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Panel de inversor
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Bienvenido{displayName ? `, ${displayName}` : ''}
      </h1>

      {isAuthAvailable ? (
        <p className="mt-4 text-lg leading-8 text-muted">
          Este es tu espacio privado en MILLENNIALS CONSTRUYEN. Desde aquí puedes consultar tu perfil, cartera, documentos y el estado de verificación.
        </p>
      ) : (
        <p className="mt-4 text-lg leading-8 text-muted">
          La zona privada para inversores está en preparación. Estamos construyendo las funcionalidades que necesitarás para gestionar tus inversiones.
        </p>
      )}

      {/* ── Navigation cards ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink to="/inversores/perfil" title="Perfil" description="Revisa los datos que tenemos registrados sobre ti." />
        <QuickLink to="/inversores/cartera" title="Cartera" description="Tus inversiones activas y su estado actual." />
        <QuickLink to="/inversores/documentos" title="Documentos" description="Contratos, certificados y documentación de tus proyectos." />
        <QuickLink to="/inversores/verificacion" title="Verificación" description="Estado de tu proceso de verificación de identidad (KYC)." />
        <QuickLink to="/inversores/oportunidades" title="Oportunidades" description="Catálogo público de oportunidades de inversión." />
        <QuickLink to="/inversores/cuenta" title="Cuenta" description="Configuración, sesiones activas y seguridad." />
      </div>

      {/* ── Status notice ── */}
      {!isAuthAvailable ? (
        <div className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
          <h2 className="font-serif text-3xl text-textLight">Área en preparación</h2>
          <p className="mt-4 leading-8 text-muted">
            Las funcionalidades de cartera, documentos y verificación de identidad (KYC) se habilitarán cuando los proveedores correspondientes estén configurados en producción.
          </p>
        </div>
      ) : (
        <div className="mt-8 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
          <strong className="text-textLight">Aviso:</strong> Las secciones de cartera, documentos y verificación muestran estados vacíos reales porque aún no tienes inversiones activas ni documentos generados. No se muestran datos simulados ni cifras ficticias.
        </div>
      )}
    </div>
  );
}

function QuickLink({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link
      to={to}
      className="border border-border bg-carbon p-6 transition hover:border-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
    >
      <h3 className="font-serif text-xl text-textLight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <span className="mt-3 inline-block text-xs font-black uppercase tracking-[0.16em] text-mineral">Acceder →</span>
    </Link>
  );
}
