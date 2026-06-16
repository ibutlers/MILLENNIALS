import { useEffect, useRef, useState } from 'react';
import { fetchPublicOpportunities, returnTypeLabel, riskLabel, statusLabel, type PublicOpportunity } from './opportunities/api';

const navigation = [
  { label: 'Firma', href: '#firma' },
  { label: 'Tesis', href: '#tesis' },
  { label: 'Método', href: '#metodologia' },
  { label: 'Oportunidades', href: '/oportunidades' },
  { label: 'FAQ', href: '#faq' }
];

const processIndicators = [
  'Análisis proyecto a proyecto',
  'Documentación estructurada',
  'Seguimiento periódico',
  'Inversión con horizonte definido',
  'Revisión técnica, comercial y financiera',
  'Actualización de avance'
];

const methodology = [
  {
    eyebrow: '01',
    title: 'Tesis de inversión',
    text: 'Definimos ubicación, demanda, estado del activo, liquidez esperada y horizonte antes de presentar una oportunidad.'
  },
  {
    eyebrow: '02',
    title: 'Metodología',
    text: 'Ordenamos documentación, supuestos y riesgos para que cada decisión pueda revisarse con trazabilidad.'
  },
  {
    eyebrow: '03',
    title: 'Tecnología y análisis',
    text: 'La capa digital prepara datos, estados, hitos y comunicación para una futura zona privada de inversores.'
  }
];

const faqs = [
  {
    question: '¿Qué publica MILLENNIALS CONSTRUYEN en abierto?',
    answer: 'Información resumida, naturaleza ilustrativa de oportunidades demo y criterios de análisis. La documentación privada llegará en una zona segura.'
  },
  {
    question: '¿Las cifras de oportunidades son reales?',
    answer: 'No. En este hito son datos demo marcados como ilustrativos para validar el diseño antes de conectar datos reales.'
  },
  {
    question: '¿Qué se construirá después?',
    answer: 'Modelo de datos, API de catálogo, detalle de oportunidad, captación de leads y, más adelante, acceso privado para inversores.'
  }
];

function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      openButtonRef.current?.focus();
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, openButtonRef, closeButtonRef, drawerRef };
}

function Header() {
  const { isOpen, setIsOpen, openButtonRef, closeButtonRef, drawerRef } = useMobileMenu();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-frost bg-white/95 backdrop-blur-xl">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-electric focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="group inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-white">
            <span className="grid h-10 w-10 place-items-center bg-electric text-lg font-black text-white">MC</span>
            <span className="grid">
              <span className="text-base font-black uppercase tracking-[0.10em] text-ink sm:text-lg">MILLENNIALS CONSTRUYEN</span>
              <span className="text-[0.60rem] font-medium uppercase tracking-[0.22em] text-charcoal/60 sm:text-[0.65rem]">Private Real Estate Investment Club</span>
            </span>
          </a>
          <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.18em] text-charcoal/70 lg:flex">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <button type="button" aria-label="Idioma español seleccionado" className="border border-frost px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-charcoal/60">
              ES / EN
            </button>
            <a href="/inversores" className="border border-frost px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-charcoal/80 transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-white">
              Acceso inversores
            </a>
          </div>
          <button
            ref={openButtonRef}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="grid h-11 w-11 place-items-center border border-frost text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-white lg:hidden"
            onClick={() => setIsOpen(true)}
          >
            <span aria-hidden="true" className="space-y-1.5">
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
            </span>
          </button>
        </div>
      </header>
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-white text-ink lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación" ref={drawerRef}>
          <div className="flex items-center justify-between border-b border-frost px-4 py-4">
            <span className="grid">
              <span className="text-base font-black uppercase tracking-[0.10em]">MILLENNIALS CONSTRUYEN</span>
              <span className="text-[0.55rem] font-medium uppercase tracking-[0.22em] text-charcoal/60">Private Real Estate Investment Club</span>
            </span>
            <button ref={closeButtonRef} type="button" aria-label="Cerrar menú" className="border border-frost px-4 py-3 text-sm font-black uppercase tracking-[0.18em] focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="grid min-h-[calc(100dvh-73px)] content-between px-6 py-8">
            <nav aria-label="Navegación móvil" className="grid gap-5 text-3xl font-serif text-ink">
              {navigation.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="border-b border-frost pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="grid gap-4">
              <div className="flex gap-3">
                <button type="button" aria-label="Idioma español seleccionado" className="border border-electric bg-electric px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">ES</button>
                <button type="button" aria-label="Cambiar idioma a inglés" className="border border-frost px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-charcoal/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">EN</button>
              </div>
              <a href="/solicitar-acceso" onClick={() => setIsOpen(false)} className="border border-electric bg-electric px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Solicitar acceso</a>
              <a href="/inversores" onClick={() => setIsOpen(false)} className="border border-frost px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Acceso inversores</a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-lavender">
      <div className="relative mx-auto flex min-h-[calc(100svh-73px)] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <p className="mb-6 max-w-max border border-electric/20 bg-electric/5 px-3 py-2 text-xs font-black uppercase tracking-[0.26em] text-electric">
          Private Real Estate Investment Club
        </p>
        <h1 className="max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-ink sm:text-6xl md:text-7xl lg:text-8xl">
          Inversión inmobiliaria con disciplina, datos y seguimiento operativo.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-charcoal/80 sm:text-xl">
          Una base digital para presentar oportunidades, ordenar documentación y preparar una futura zona privada de inversores sin promesas grandilocuentes.
        </p>
        <div className="mt-8 grid gap-3 sm:flex">
          <a href="/oportunidades" className="group inline-flex items-center justify-center gap-3 bg-electric px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-4 focus-visible:ring-offset-lavender">
            Ver oportunidades demo <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
          </a>
          <a href="#firma" className="inline-flex items-center justify-center border border-frost px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-4 focus-visible:ring-offset-lavender">
            Nuestra firma
          </a>
        </div>
      </div>
    </section>
  );
}

function FirmNarrative() {
  return (
    <section id="firma" className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Sobre la firma</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
            Selección rigurosa antes que volumen.
          </h2>
        </div>
        <div className="space-y-7 text-lg leading-9 text-charcoal/80">
          <p>
            MILLENNIALS CONSTRUYEN se plantea como una plataforma inmobiliaria profesional para explicar una tesis, organizar oportunidades y comunicar avances con transparencia.
          </p>
          <p>
            La primera capa pública evita cifras no verificadas y prioriza proceso: revisión técnica, comercial y financiera, documentación estructurada y seguimiento periódico.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section id="tesis" className="bg-lavender py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Tesis de inversión</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
              Menos ruido, más trazabilidad.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-frost bg-frost sm:grid-cols-2">
            {processIndicators.map((item) => (
              <div key={item} className="bg-white p-6">
                <span className="mb-5 block h-8 w-8 bg-electric/10" aria-hidden="true" />
                <p className="text-xl font-semibold text-ink">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Methodology() {
  return (
    <section id="metodologia" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Metodología</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
            Una arquitectura tecnológica visible desde el primer contacto.
          </h2>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-frost bg-frost lg:grid-cols-3">
          {methodology.map((item) => (
            <article key={item.title} className="bg-white p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-electric">{item.eyebrow}</p>
              <h3 className="mt-8 font-serif text-3xl tracking-[-0.03em] text-ink">{item.title}</h3>
              <p className="mt-5 leading-8 text-charcoal/80">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OpportunityCard({ opportunity }: { opportunity: PublicOpportunity }) {
  const progress = Math.max(0, Math.min(100, opportunity.fundingProgress));
  const location = [opportunity.city, opportunity.district].filter(Boolean).join(' · ');
  const showFinancials = (opportunity.targetAmount?.cents ?? 0) > 1;
  const showProgress = progress === 100 || (progress > 0 && (opportunity.committedAmount?.cents ?? 0) > 0);
  const isFunded = progress === 100 && showProgress;

  return (
    <article aria-label={`Proyecto: ${opportunity.title}`} className="overflow-hidden rounded-lg border border-frost bg-white">
      <div className="relative">
        {opportunity.primaryImage ? (
          <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="600" loading="lazy" className="h-52 w-full object-cover" />
        ) : (
          <div className="h-52 w-full bg-electric/5" role="img" aria-label="Imagen pendiente de publicar" />
        )}
        <span className="absolute bottom-2 right-2 border border-white/30 bg-ink/60 px-2 py-0.5 text-[0.60rem] font-medium uppercase tracking-[0.14em] text-white backdrop-blur-sm">Imagen provisional</span>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-electric/30 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-electric">{statusLabel(opportunity.status)}</span>
          {isFunded ? <span className="border border-electric/30 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-electric">Financiación cerrada</span> : null}
          {opportunity.strategy === 'Cambio de uso' ? <span className="border border-frost px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-charcoal/60">Cambio de uso</span> : null}
        </div>
        <h3 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.03em] text-ink">{opportunity.title}</h3>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-charcoal/60">{location}</p>
        <p className="mt-4 leading-7 text-charcoal/80">{opportunity.shortDescription}</p>
        {showFinancials ? (
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-frost bg-frost text-sm">
            <div className="bg-white p-3"><dt className="text-charcoal/60">{returnTypeLabel(opportunity.targetReturnType)}</dt><dd className="mt-1 font-serif text-2xl text-ink">{opportunity.targetReturn.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Plazo estimado</dt><dd className="mt-1 font-semibold text-ink">{opportunity.estimatedTermMonths} meses</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Ticket mínimo</dt><dd className="mt-1 font-semibold text-ink">{opportunity.minimumInvestment?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Capital objetivo</dt><dd className="mt-1 font-semibold text-ink">{opportunity.targetAmount?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Capital comprometido</dt><dd className="mt-1 font-semibold text-ink">{opportunity.committedAmount?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Nivel de riesgo</dt><dd className="mt-1 font-semibold text-ink">{riskLabel(opportunity.riskLevel)} · no regulatorio</dd></div>
          </dl>
        ) : null}
        {showProgress ? (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.18em] text-charcoal/60"><span>Financiación</span><span>Capital cubierto · {progress}%</span></div>
            <div className="h-2 rounded-full bg-frost"><div className="h-2 rounded-full bg-electric" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : null}
        <a href={`/oportunidades/${opportunity.slug}`} className="mt-6 inline-flex rounded-lg border border-frost px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Ver proyecto</a>
      </div>
    </article>
  );
}

type OpportunitiesState =
  | { status: 'loading'; data: PublicOpportunity[]; disclaimer: string | null }
  | { status: 'success'; data: PublicOpportunity[]; disclaimer: string }
  | { status: 'error'; data: PublicOpportunity[]; disclaimer: string | null }
  | { status: 'empty'; data: PublicOpportunity[]; disclaimer: string | null };

function usePublicOpportunities(): OpportunitiesState {
  const [state, setState] = useState<OpportunitiesState>({ status: 'loading', data: [], disclaimer: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: [], disclaimer: null });

    fetchPublicOpportunities(controller.signal)
      .then((response) => {
        if (response.data.length === 0) {
          setState({ status: 'empty', data: [], disclaimer: response.meta.disclaimer });
          return;
        }
        setState({ status: 'success', data: response.data, disclaimer: response.meta.disclaimer });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', data: [], disclaimer: null });
      });

    return () => controller.abort();
  }, []);

  return state;
}

function Opportunities() {
  const opportunitiesState = usePublicOpportunities();

  return (
    <section id="oportunidades" className="bg-lavender py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Oportunidades actuales</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
              Información pública resumida desde PostgreSQL, sin exponer contenido privado.
            </h2>
          </div>
          <p className="leading-8 text-charcoal/80">
            Las oportunidades proceden de la API pública de MILLENNIALS CONSTRUYEN. Los objetivos son estimaciones no garantizadas y no representan una oferta pública ni resultados pasados.
          </p>
        </div>

        {opportunitiesState.status === 'loading' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60" role="status">Cargando oportunidades públicas…</div>
        ) : null}

        {opportunitiesState.status === 'error' ? (
          <div className="mt-10 rounded-lg border border-warning/40 bg-warning/5 p-8 text-charcoal/80" role="alert">No hemos podido cargar las oportunidades públicas. La API no está disponible temporalmente; no mostramos datos falsos como si fueran reales.</div>
        ) : null}

        {opportunitiesState.status === 'empty' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60">No hay oportunidades públicas disponibles en este momento.</div>
        ) : null}

        {opportunitiesState.status === 'success' ? (
          <>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {opportunitiesState.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}
            </div>
            <p className="mt-6 text-sm leading-7 text-charcoal/60">{opportunitiesState.disclaimer}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">FAQ</p>
        <h2 className="mt-5 font-serif text-4xl tracking-[-0.03em] text-ink sm:text-6xl">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-frost border-y border-frost">
          {faqs.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                {item.question}
                <span aria-hidden="true" className="text-3xl text-electric transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl leading-8 text-charcoal/80">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessCta() {
  return (
    <section id="acceso" className="bg-electric py-16 text-white sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">Acceso privado futuro</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-white sm:text-6xl">
            Preparado para documentación, hitos y seguimiento de inversores.
          </h2>
        </div>
        <div className="grid gap-3 sm:flex lg:grid">
          <a href="/solicitar-acceso" className="bg-white px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-electric transition hover:bg-frost focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-electric">Solicitar acceso</a>
          <a href="/contacto" className="border border-white/30 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:border-white hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-electric">Contactar</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-lavender" role="contentinfo">
      <div className="mx-auto grid max-w-7xl gap-8 border-t border-frost px-4 py-10 text-sm text-charcoal/70 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="text-lg font-black uppercase tracking-[0.12em] text-ink">MILLENNIALS CONSTRUYEN</p>
          <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-charcoal/50">Private Real Estate Investment Club</p>
          <p className="mt-3 max-w-xl">Plataforma inmobiliaria en construcción. Esta página usa datos demo y activos visuales generados específicamente para MILLENNIALS CONSTRUYEN.</p>
        </div>
        <nav aria-label="Navegación secundaria" className="flex flex-wrap gap-4 font-semibold">
          {navigation.map((item) => <a key={item.href} className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" href={item.href}>{item.label}</a>)}
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-lavender text-ink antialiased">
      <Header />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <FirmNarrative />
        <ProcessSection />
        <Methodology />
        <Opportunities />
        <Faq />
        <AccessCta />
      </main>
      <Footer />
    </div>
  );
}
