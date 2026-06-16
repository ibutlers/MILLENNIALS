import React, { Suspense, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/context';

const NAV_ITEMS: Array<{ path: string; label: string; exact?: boolean; roles?: string[] }> = [
  { path: '/admin', label: 'Dashboard', exact: true },
  { path: '/admin/oportunidades', label: 'Oportunidades' },
  { path: '/admin/leads', label: 'Leads' },
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

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading, checkedAvailability, isAuthAvailable, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading || !checkedAvailability) return <AdminGuardLoader />;

  if (!isAuthAvailable) {
    return (
      <main className="min-h-screen bg-[#08191C] text-[#FBF7F0]" role="main">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-serif text-4xl tracking-tight">Panel en preparación</h1>
          <p className="mt-6 text-lg text-[#9B7E5F]">
            El panel administrativo estará disponible cuando la autenticación y el dominio HTTPS estén configurados.
          </p>
          <p className="mt-2 text-sm text-[#5C8D7A]">
            Requisitos: HTTPS, AUTH_ENABLED=true, ADMIN_ENABLED=true
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen bg-[#08191C] text-[#FBF7F0]" role="main">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-serif text-4xl">Acceso restringido</h1>
          <p className="mt-4 text-[#9B7E5F]">Inicia sesión para acceder al panel.</p>
        </div>
      </main>
    );
  }

  const userRoles = user.roles || [];
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  if (!isAdmin && !isOperator) {
    return (
      <main className="min-h-screen bg-[#08191C] text-[#FBF7F0]" role="main">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-serif text-4xl">Sin permisos</h1>
          <p className="mt-4 text-[#9B7E5F]">No tienes permisos para acceder al panel administrativo.</p>
        </div>
      </main>
    );
  }

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
              {NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => userRoles.includes(r))).map((item) => (
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
