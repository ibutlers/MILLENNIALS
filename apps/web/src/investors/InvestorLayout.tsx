import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/context';

const navItems = [
  { label: 'Oportunidades', href: '/inversores/oportunidades' },
  { label: 'Cuenta', href: '/inversores/cuenta' },
  { label: 'Seguridad', href: '/inversores/seguridad' },
];

function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); return; }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      openButtonRef.current?.focus();
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, openButtonRef, closeButtonRef, drawerRef };
}

export function InvestorLayout() {
  const { user, isAuthAvailable, logout } = useAuth();
  const location = useLocation();
  const { isOpen, setIsOpen, openButtonRef, closeButtonRef, drawerRef } = useMobileMenu();
  const isActive = useCallback((href: string) => location.pathname === href, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-carbon text-textLight antialiased">
      <header className="sticky top-0 z-40 border-b border-border bg-carbon/95 shadow-2xl shadow-petroleum/30 backdrop-blur-xl">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-mineral focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-textDark">
          Saltar al contenido
        </a>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/inversores" className="group inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
            <span className="grid h-10 w-10 place-items-center border border-mineral/70 text-lg font-black text-mineral">MC</span>
            <span className="text-lg font-black uppercase tracking-[0.12em] sm:text-xl">MILLENNIALS CONSTRUYEN</span>
          </Link>

          {isAuthAvailable ? (
            <div className="hidden items-center gap-4 lg:flex">
              <nav aria-label="Navegación de inversor" className="flex items-center gap-6 text-xs font-bold uppercase tracking-[0.18em] text-muted">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`transition hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon ${isActive(item.href) ? 'text-mineral' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex items-center gap-3 border-l border-border pl-4">
                <span className="text-xs text-muted">{user?.email}</span>
                {user?.roles && user.roles.length > 0 ? (
                  <span className="border border-border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-mineral">
                    {user.roles[0]}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted transition hover:border-danger hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
                >
                  Salir
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden items-center gap-3 lg:flex">
              <Link to="/" className="border border-border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">
                Volver a la home
              </Link>
            </div>
          )}

          <button
            ref={openButtonRef}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="grid h-11 w-11 place-items-center border border-border text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon lg:hidden"
            onClick={() => setIsOpen(true)}
          >
            <span aria-hidden="true" className="space-y-1.5">
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
            </span>
          </button>
        </div>
      </header>
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-carbon text-textLight lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de inversor" ref={drawerRef}>
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <span className="text-lg font-black uppercase tracking-[0.12em]">MILLENNIALS CONSTRUYEN</span>
            <button ref={closeButtonRef} type="button" aria-label="Cerrar menú" className="border border-border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover" onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="grid min-h-[calc(100dvh-73px)] content-between px-6 py-8">
            <nav aria-label="Navegación móvil" className="grid gap-5 text-3xl font-serif text-textLight">
              {navItems.map((item) => (
                <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)} className={`border-b border-border pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover ${isActive(item.href) ? 'text-mineral' : ''}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="grid gap-4">
              {isAuthAvailable && user ? (
                <>
                  <p className="text-sm text-muted">{user.email}</p>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); handleLogout(); }}
                    className="border border-border px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textLight hover:border-danger hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link to="/" onClick={() => setIsOpen(false)} className="border border-border px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textLight hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">
                  Volver a la home
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
