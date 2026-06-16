import { useEffect } from "react";
import { setPageMetadata } from "../metadata";

export function InvestorPortfolio() {
  useEffect(() => {
    setPageMetadata(
      "Cartera | MILLENNIALS CONSTRUYEN",
      "Cartera de inversiones en MILLENNIALS CONSTRUYEN."
    );
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Cartera
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Tu cartera
      </h1>

      {/* Honest empty state — no fake data */}
      <section className="mt-8 border border-border bg-petroleum p-8 text-center sm:p-12">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-2xl text-muted"
          aria-hidden="true"
        >
          ∅
        </div>
        <h2 className="font-serif text-2xl text-textLight">
          Todavía no tienes inversiones activas.
        </h2>
        <p className="mt-4 max-w-md mx-auto leading-7 text-muted">
          Cuando el producto abra la funcionalidad de inversión y completes tu
          primera operación, tu cartera aparecerá aquí con tus posiciones
          reales.
        </p>
      </section>

      {/* What to expect — informative, not simulated */}
      <section className="mt-6 border border-border bg-carbon p-6 sm:p-8">
        <h2 className="font-serif text-xl text-textLight">
          ¿Qué verás aquí cuando esté activo?
        </h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Capital comprometido y aportado por cada proyecto</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Distribuciones y rendimientos reales recibidos</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Actualizaciones de hitos de cada proyecto</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Estado fiscal de cada inversión</span>
          </li>
        </ul>
      </section>

      {/* Explicit: no fake numbers */}
      <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        No se muestra rentabilidad simulada, capital ficticio ni gráficos de
        ejemplo. Todo lo que ves en tu cartera corresponde exclusivamente a tus
        operaciones reales.
      </div>
    </div>
  );
}
