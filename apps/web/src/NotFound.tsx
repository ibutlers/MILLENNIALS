export function NotFound() {
  return (
    <div className="flex min-h-screen bg-carbon text-textLight">
      <main className="mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="border border-mineral/50 px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-mineral">
          Error 404
        </p>
        <h1 className="mt-6 font-serif text-5xl leading-tight tracking-[-0.04em] sm:text-7xl">No encontramos esta página.</h1>
        <p className="mt-5 text-lg leading-8 text-muted">
          La ruta solicitada no forma parte de la experiencia pública de MILLENNIALS CONSTRUYEN | CAPITAL. Vuelve al inicio para consultar la tesis, metodología y oportunidades demo.
        </p>
        <a
          href="/"
          className="mt-8 bg-mineral px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
        >
          Volver al inicio
        </a>
      </main>
    </div>
  );
}
