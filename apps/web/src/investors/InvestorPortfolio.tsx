import { useEffect, useState } from "react";
import { Link } from "react-router";
import { setPageMetadata } from "../metadata";

interface InvestorProject {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  status: string;
  target_amount_cents: number;
  committed_amount_cents: number;
  investor_committed_amount_cents: number;
  investor_currency: string;
  investor_notes?: string | null;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "success"; data: InvestorProject[] };

function centsToEur(cents: number | null | undefined, currency = "EUR"): string {
  return ((cents ?? 0) / 100).toLocaleString("es-ES", { style: "currency", currency });
}

export function InvestorPortfolio() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    setPageMetadata(
      "Cartera | MILLENNIALS CONSTRUYEN",
      "Cartera de inversiones en MILLENNIALS CONSTRUYEN."
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch("/api/investor/projects", { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("portfolio_unavailable");
        const body = await response.json();
        const projects = Array.isArray(body.data) ? body.data : [];
        const assigned = projects.filter((item: InvestorProject) => Number(item.investor_committed_amount_cents ?? 0) > 0);
        setState(assigned.length > 0 ? { status: "success", data: assigned } : { status: "empty" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  const total = state.status === "success" ? state.data.reduce((sum, item) => sum + Number(item.investor_committed_amount_cents ?? 0), 0) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Cartera
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Tu cartera
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
        Posiciones reales asignadas por el equipo. No mostramos importes simulados ni rentabilidades no confirmadas.
      </p>

      {state.status === "loading" ? (
        <section className="mt-8 border border-border bg-petroleum p-8 text-muted" role="status">
          Cargando cartera…
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="mt-8 border border-danger bg-danger/10 p-8 text-textLight" role="alert">
          No hemos podido cargar tu cartera en este momento.
        </section>
      ) : null}

      {state.status === "empty" ? (
        <section className="mt-8 border border-border bg-petroleum p-8 text-center sm:p-12">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-2xl text-muted"
            aria-hidden="true"
          >
            ∅
          </div>
          <h2 className="font-serif text-2xl text-textLight">
            Todavía no tienes capital asignado a proyectos.
          </h2>
          <p className="mt-4 max-w-md mx-auto leading-7 text-muted">
            Cuando el equipo convierta tu solicitud y asigne capital real a un proyecto, aparecerá aquí.
          </p>
        </section>
      ) : null}

      {state.status === "success" ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="border border-border bg-petroleum p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Capital comprometido</p>
              <p className="mt-2 font-serif text-3xl text-textLight">{centsToEur(total)}</p>
            </div>
            <div className="border border-border bg-petroleum p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Proyectos activos</p>
              <p className="mt-2 font-serif text-3xl text-textLight">{state.data.length}</p>
            </div>
            <div className="border border-border bg-petroleum p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Estado</p>
              <p className="mt-2 font-serif text-3xl text-textLight">Real</p>
            </div>
          </section>

          <section className="mt-6 overflow-hidden border border-border bg-carbon">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr><th className="p-4">Proyecto</th><th className="p-4">Capital asignado</th><th className="p-4">Estado</th><th className="p-4">Acción</th></tr>
              </thead>
              <tbody>
                {state.data.map((item) => (
                  <tr key={item.id} className="border-b border-border/60">
                    <td className="p-4"><p className="font-medium text-textLight">{item.title}</p><p className="text-xs text-muted">{item.city ?? "—"}</p>{item.investor_notes && <p className="mt-1 text-xs text-muted">{item.investor_notes}</p>}</td>
                    <td className="p-4 font-medium text-textLight">{centsToEur(Number(item.investor_committed_amount_cents), item.investor_currency || "EUR")}</td>
                    <td className="p-4 text-muted">{item.status}</td>
                    <td className="p-4"><Link to={`/inversores/proyectos/${item.slug}`} className="text-mineral underline-offset-4 hover:underline">Ver proyecto</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        La cartera se alimenta únicamente de asignaciones registradas por administración. No permite pagos ni firma de operaciones desde esta pantalla.
      </div>
    </div>
  );
}
