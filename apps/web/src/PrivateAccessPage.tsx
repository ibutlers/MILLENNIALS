import { Link } from 'react-router';
import { CoinvestSection } from './App';

// ── Minimal header (72–76px, no nav, no lang, no Login) ──

function MinimalHeader() {
  return (
    <header className="border-b border-frost bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-8">
        {/* Brand */}
        <Link
          to="/"
          className="inline-flex flex-shrink-0 items-center gap-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
        >
          <span className="grid h-[36px] w-[36px] flex-shrink-0 place-items-center bg-electric text-[13px] font-black text-white select-none">
            MC
          </span>
          <span className="hidden text-[16px] font-bold tracking-[0.02em] text-ink select-none sm:inline">
            MILLENNIALS CONSTRUYEN
          </span>
        </Link>

        {/* Return link */}
        <Link
          to="/"
          className="text-[13px] font-medium text-charcoal/55 transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
        >
          Volver al sitio
        </Link>
      </div>
    </header>
  );
}

// ── Main page ──

export function PrivateAccessPage() {
  return (
    <div className="min-h-screen bg-white text-ink antialiased">
      <MinimalHeader />

      <main id="contenido">
        {/* Two-column composite block */}
        <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="grid w-full max-w-[1100px] overflow-hidden border border-frost md:grid-cols-[45%_55%]">
            {/* ── Left panel: dark editorial ── */}
            <div className="flex flex-col justify-center bg-ink px-8 py-10 text-white sm:px-10 sm:py-12 lg:px-12 lg:py-12">
              <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-electric">
                ÁREA PRIVADA
              </p>
              <h1 className="font-serif text-[36px] leading-[1.05] tracking-[-0.02em] sm:text-[42px] lg:text-[48px]">
                Acceso para inversores.
              </h1>
              <p className="mt-5 text-[15px] leading-[1.7] text-white/70 sm:text-[16px]">
                La zona privada reunirá la documentación, las comunicaciones y el
                seguimiento de las oportunidades en las que participe cada inversor.
              </p>
              <ul className="mt-7 grid gap-3 text-[14px] text-white/55 sm:text-[15px]">
                <li className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 flex-shrink-0 bg-electric" aria-hidden="true" />
                  <span>Documentación centralizada</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 flex-shrink-0 bg-electric" aria-hidden="true" />
                  <span>Seguimiento de proyectos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 flex-shrink-0 bg-electric" aria-hidden="true" />
                  <span>Comunicaciones privadas</span>
                </li>
              </ul>
              <p className="mt-6 text-[13px] leading-[1.6] text-white/40">
                El acceso se habilitará individualmente cuando la zona privada esté
                disponible.
              </p>
            </div>

            {/* ── Right panel: light informational ── */}
            <div className="flex flex-col justify-center bg-[#FAFAF7] px-8 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-12">
              <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-charcoal/45">
                ACCESO PRIVADO
              </p>
              <h2 className="font-serif text-[24px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[28px]">
                La zona de inversores está en preparación.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-charcoal/75 sm:text-[16px]">
                El acceso estará reservado a inversores previamente validados y se
                activará de forma individual cuando el área privada esté disponible.
              </p>
              <p className="mt-4 text-[15px] leading-[1.7] text-charcoal/65 sm:text-[16px]">
                Mientras tanto, puedes solicitar acceso al club y conocer las
                oportunidades públicas disponibles.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-[auto_auto] sm:justify-start">
                <a
                  href="#solicitud"
                  className="inline-flex h-[46px] items-center justify-center rounded bg-ink px-7 text-[13px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
                >
                  SOLICITAR ACCESO
                </a>
                <a
                  href="/#proyectos"
                  className="inline-flex h-[46px] items-center justify-center rounded border border-frost px-7 text-[13px] font-bold uppercase tracking-[0.1em] text-charcoal/80 transition hover:border-ink hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
                >
                  VER PROYECTOS
                </a>
              </div>

              <p className="mt-6 text-[12px] leading-[1.6] text-charcoal/40">
                Enviar una solicitud no garantiza el acceso al club ni implica
                ningún compromiso de inversión.
              </p>
            </div>
          </div>
        </div>

        {/* ── Solicitud form section ── */}
        <div id="solicitud">
          <CoinvestSection />
        </div>
      </main>
    </div>
  );
}
