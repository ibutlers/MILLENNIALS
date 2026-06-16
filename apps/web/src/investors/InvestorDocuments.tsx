import { useEffect } from "react";
import { setPageMetadata } from "../metadata";

export function InvestorDocuments() {
  useEffect(() => {
    setPageMetadata(
      "Documentos | MILLENNIALS CONSTRUYEN",
      "Documentos de inversor en MILLENNIALS CONSTRUYEN."
    );
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Documentos
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Tus documentos
      </h1>

      {/* Honest empty state */}
      <section className="mt-8 border border-border bg-petroleum p-8 text-center sm:p-12">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-2xl text-muted"
          aria-hidden="true"
        >
          ∅
        </div>
        <h2 className="font-serif text-2xl text-textLight">
          No hay documentos disponibles.
        </h2>
        <p className="mt-4 max-w-md mx-auto leading-7 text-muted">
          Cuando realices tu primera inversión, aquí encontrarás los contratos,
          certificados y documentación legal de cada proyecto.
        </p>
      </section>

      {/* Explicit: no fake documents */}
      <section className="mt-6 border border-border bg-carbon p-6 sm:p-8">
        <h2 className="font-serif text-xl text-textLight">
          Tipos de documentos que aparecerán aquí
        </h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted sm:grid-cols-2">
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Contrato de inversión firmado</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Certificado de participación</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Informes trimestrales del proyecto</span>
          </li>
          <li className="flex gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 bg-mineral"
              aria-hidden="true"
            />
            <span>Documentación fiscal anual</span>
          </li>
        </ul>
      </section>

      <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        No generamos contratos, certificados ni descargas simuladas. Todos los
        documentos que aparezcan aquí serán reales y específicos de tus
        operaciones.
      </div>
    </div>
  );
}
