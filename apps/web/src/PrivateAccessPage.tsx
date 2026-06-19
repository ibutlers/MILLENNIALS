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
          className="text-[13px] font-medium text-charcoal/70 transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
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
        <div id="solicitud">
          <CoinvestSection />
        </div>
      </main>
    </div>
  );
}
