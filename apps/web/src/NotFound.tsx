export function NotFound() {
  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(227,179,65,.2),transparent_30%),#f8fafc] text-slate-950">
      <main className="mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="rounded-full bg-brand-accent/20 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-brand-primary">
          Error 404
        </p>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">No encontramos esta página.</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          La ruta solicitada no forma parte de la experiencia pública de Realstate. Vuelve al inicio para explorar las propiedades destacadas.
        </p>
        <a
          href="/"
          className="mt-8 rounded-full bg-brand-primary px-6 py-3 text-base font-bold text-white shadow-lg shadow-brand-primary/20 transition hover:-translate-y-0.5 hover:bg-[#0b3d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4"
        >
          Volver al inicio
        </a>
      </main>
    </div>
  );
}
