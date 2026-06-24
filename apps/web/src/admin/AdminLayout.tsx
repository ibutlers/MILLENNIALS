import React, { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation } from 'react-router';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/context';
import { normalizeAuthRoles } from '../auth/roles';

const NAV_ITEMS: Array<{ path: string; label: string; exact?: boolean; roles?: string[] }> = [
  { path: '/admin', label: 'Dashboard', exact: true },
  { path: '/admin/oportunidades', label: 'Oportunidades' },
  { path: '/admin/leads', label: 'Leads' },
  { path: '/admin/inversiones', label: 'Inversiones' },
  { path: '/admin/usuarios', label: 'Usuarios', roles: ['admin'] },
  { path: '/admin/auditoria', label: 'Auditoría', roles: ['admin'] },
];

function AdminGuardLoader() {
  return (
    <main className="min-h-screen bg-[#08191C] text-[#FBF7F0]" role="status" aria-label="Cargando panel administrativo">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5C8D7A] border-t-[#7FA88C]" aria-hidden="true" />
        <p className="mt-4 text-[#9B7E5F]">Verificando acceso…</p>
      </div>
    </main>
  );
}

type AdminApiError = Error & { status?: number; code?: string };

function AdminAccessMessage({
  title,
  message,
  detail,
  children,
}: {
  title: string;
  message: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#08191C] text-[#FBF7F0]" role="main">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
        <p className="mt-6 text-lg text-[#9B7E5F]">{message}</p>
        {detail ? <p className="mt-2 text-sm text-[#5C8D7A]">{detail}</p> : null}
        {children}
      </div>
    </main>
  );
}

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading, checkedAvailability, isAuthAvailable, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminAccessQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => apiFetch('/api/v1/admin/dashboard'),
    enabled: checkedAvailability && isAuthAvailable === true && isAuthenticated && !!user,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading || !checkedAvailability) return <AdminGuardLoader />;

  if (!isAuthAvailable) {
    return (
      <AdminAccessMessage
        title="Panel en preparación"
        message="El panel administrativo estará disponible cuando la autenticación y el dominio HTTPS estén configurados."
        detail="Requisitos: HTTPS, AUTH_ENABLED=*** ADMIN_ENABLED=true"
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <AdminAccessMessage title="Acceso restringido" message="Inicia sesión para acceder al panel.">
        <Link
          to={`/acceso/login?retorno=${encodeURIComponent(location.pathname + location.search)}`}
          className="mt-8 inline-flex rounded bg-[#7FA88C] px-5 py-3 font-medium text-[#08191C] transition-colors hover:bg-[#5C8D7A] focus:outline-2 focus:outline-offset-2 focus:outline-[#7FA88C]"
        >
          Iniciar sesión
        </Link>
      </AdminAccessMessage>
    );
  }

  if (adminAccessQuery.isLoading || adminAccessQuery.isFetching) return <AdminGuardLoader />;

  if (adminAccessQuery.isError) {
    const error = adminAccessQuery.error as AdminApiError;
    if (error.status === 401) {
      return (
        <AdminAccessMessage title="Acceso restringido" message="Tu sesión no permite abrir el panel administrativo.">
          <Link
            to={`/acceso/login?retorno=${encodeURIComponent(location.pathname + location.search)}`}
            className="mt-8 inline-flex rounded bg-[#7FA88C] px-5 py-3 font-medium text-[#08191C] transition-colors hover:bg-[#5C8D7A] focus:outline-2 focus:outline-offset-2 focus:outline-[#7FA88C]"
          >
            Iniciar sesión con otra cuenta
          </Link>
        </AdminAccessMessage>
      );
    }
    if (error.status === 403 && error.code === 'mfa_required') {
      const setupHref = `/acceso/2fa?retorno=${encodeURIComponent(location.pathname + location.search)}`;
      return (
        <AdminAccessMessage
          title="Verificación en dos pasos requerida"
          message="Tu cuenta admin está activa, pero debe completar MFA antes de abrir el panel administrativo."
          detail="Usa la API oficial de Better Auth: genera la clave TOTP, verifica el código y reconcilia el acceso."
        >
          <Link
            to={setupHref}
            className="mt-8 inline-flex rounded bg-[#7FA88C] px-5 py-3 font-medium text-[#08191C] transition-colors hover:bg-[#5C8D7A] focus:outline-2 focus:outline-offset-2 focus:outline-[#7FA88C]"
          >
            Configurar verificación 2FA
          </Link>
        </AdminAccessMessage>
      );
    }
    if (error.status === 403) {
      return (
        <AdminAccessMessage
          title="Sin permisos"
          message="Tu cuenta está autenticada, pero no tiene rol administrativo u operador para acceder al panel."
        />
      );
    }
    if (error.status === 503 || error.code === 'admin_disabled') {
      return (
        <AdminAccessMessage
          title="Panel en preparación"
          message="El panel administrativo todavía no está habilitado."
          detail="Backend administrativo no disponible para esta sesión."
        />
      );
    }
    return (
      <AdminAccessMessage
        title="No se pudo verificar el acceso"
        message="El panel no se renderiza hasta confirmar el permiso administrativo con el servidor."
        detail={error.message || 'Error desconocido'}
      />
    );
  }

  const userRoles = normalizeAuthRoles(user.roles);
  const navRoles = userRoles.some((role) => ['admin', 'operator'].includes(role)) ? userRoles : ['operator'];

  const currentLabel = NAV_ITEMS.find((item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  })?.label;

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#0F2A30] text-[#FBF7F0]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#7FA88C] focus:p-3 focus:text-[#08191C]">
        Saltar al contenido principal
      </a>

      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-[#1A3E48] bg-[#08191C] px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded p-2 text-[#7FA88C] hover:bg-[#1A3E48] focus:outline-2 focus:outline-[#7FA88C]"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <span className="font-serif text-lg text-[#7FA88C]">Panel</span>
        <button onClick={logout} className="rounded px-3 py-1.5 text-sm text-[#9B7E5F] hover:bg-[#1A3E48] focus:outline-2 focus:outline-[#7FA88C]">
          Salir
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-[#08191C] transition-transform lg:static lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col border-r border-[#1A3E48]">
            <div className="border-b border-[#1A3E48] px-6 py-5">
              <h2 className="font-serif text-xl tracking-tight text-[#7FA88C]">MILLENNIALS CONSTRUYEN</h2>
              <p className="mt-1 text-xs text-[#5C8D7A]">Panel administrativo</p>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegación administrativa">
              {NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => navRoles.includes(r))).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded px-4 py-2.5 text-sm transition-colors focus:outline-2 focus:outline-[#7FA88C] ${
                    isActive(item.path, item.exact)
                      ? 'bg-[#1A3E48] text-[#7FA88C] font-medium'
                      : 'text-[#FBF7F0] hover:bg-[#0F2A30] hover:text-[#7FA88C]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-[#1A3E48] px-6 py-4">
              <p className="text-sm font-medium text-[#FBF7F0]">{user.name || user.email}</p>
              <p className="text-xs text-[#5C8D7A]">{userRoles.filter(r => r !== 'investor').join(', ') || 'sin rol'}</p>
              <button onClick={logout} className="mt-3 w-full rounded bg-[#1A3E48] px-3 py-2 text-sm text-[#9B7E5F] hover:bg-[#0F2A30] focus:outline-2 focus:outline-[#7FA88C]">
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
        )}

        {/* Main */}
        <div className="min-h-screen flex-1">
          {/* Breadcrumbs */}
          {currentLabel && (
            <div className="border-b border-[#1A3E48] bg-[#08191C] px-6 py-3">
              <nav aria-label="Breadcrumb" className="text-sm text-[#9B7E5F]">
                <Link to="/admin" className="hover:text-[#7FA88C]">Panel</Link>
                {currentLabel !== 'Dashboard' && <span className="mx-2">/</span>}
                {currentLabel !== 'Dashboard' && <span className="text-[#FBF7F0]">{currentLabel}</span>}
              </nav>
            </div>
          )}
          <main id="admin-main" className="p-4 lg:p-8">
            <Suspense fallback={<div className="animate-pulse text-[#9B7E5F]">Cargando sección…</div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
