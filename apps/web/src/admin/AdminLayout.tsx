import { Suspense } from 'react';
import { Outlet } from 'react-router';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-carbon text-textLight">
      <header className="border-b border-border bg-petroleum px-6 py-4">
        <h1 className="font-serif text-2xl tracking-tight text-mineral">Panel administrativo</h1>
        <p className="text-sm text-muted">El panel estará disponible cuando la autenticación esté habilitada en producción.</p>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="border border-border bg-petroleum p-8 text-center">
          <h2 className="font-serif text-3xl text-textLight">Panel en preparación</h2>
          <p className="mt-4 text-muted">
            La administración de oportunidades, leads y usuarios estará disponible próximamente.
            Este panel requiere HTTPS, autenticación habilitada y un dominio real.
          </p>
        </div>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
