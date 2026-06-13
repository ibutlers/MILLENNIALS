export function NotFound() {
  return (
    <div className="flex min-h-screen bg-carbon text-ivory">
      <main className="mx-auto flex w-full max-w-3xl flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="border border-copper/50 px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-copper">
          Error 404
        </p>
        <h1 className="mt-6 font-serif text-5xl leading-tight tracking-[-0.04em] sm:text-7xl">No encontramos esta página.</h1>
        <p className="mt-5 text-lg leading-8 text-ivory/68">
          La ruta solicitada no forma parte de la experiencia pública de Realstate. Vuelve al inicio para consultar la tesis, metodología y oportunidades demo.
        </p>
        <a
          href="/"
          className="mt-8 bg-copper px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-carbon transition hover:bg-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
        >
          Volver al inicio
        </a>
      </main>
    </div>
  );
}
