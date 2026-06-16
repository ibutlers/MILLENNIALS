import { useEffect } from "react";
import { setPageMetadata } from "../metadata";

export function InvestorVerification() {
  useEffect(() => {
    setPageMetadata(
      "Verificación | MILLENNIALS CONSTRUYEN | CAPITAL",
      "Verificación de identidad en MILLENNIALS CONSTRUYEN | CAPITAL."
    );
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Verificación
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Verificación de identidad
      </h1>

      {/* Disabled KYC state */}
      <section className="mt-8 border border-border bg-petroleum p-8 text-center sm:p-12">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-2xl text-muted"
          aria-hidden="true"
        >
          ⏳
        </div>
        <h2 className="font-serif text-2xl text-textLight">
          La verificación todavía no está disponible.
        </h2>
        <p className="mt-4 max-w-md mx-auto leading-7 text-muted">
          El proceso de verificación de identidad (KYC) se habilitará cuando
          integremos un proveedor externo autorizado. No mostramos un estado
          "verificado" porque no lo estás — el proceso aún no ha comenzado.
        </p>
      </section>

      {/* Action — controlled error on click */}
      <section className="mt-6 border border-border bg-carbon p-6 sm:p-8">
        <h2 className="font-serif text-xl text-textLight">
          ¿Qué implica la verificación?
        </h2>
        <p className="mt-3 leading-7 text-muted">
          Para cumplir con la normativa de prevención del blanqueo de capitales,
          necesitaremos verificar tu identidad antes de que puedas invertir.
          Esto incluirá:
        </p>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Documento de identidad oficial</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Comprobante de domicilio</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Autocertificación de residencia fiscal</span>
          </li>
        </ul>

        <button
          type="button"
          disabled
          className="mt-6 border border-border px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-muted cursor-not-allowed opacity-50"
          aria-label="Verificación de identidad no disponible"
        >
          Iniciar verificación
        </button>
      </section>

      <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        No simulamos progreso de verificación ni mostramos un estado
        "verificado" falso. El botón permanece deshabilitado hasta que el
        proveedor de KYC esté configurado.
      </div>
    </div>
  );
}
