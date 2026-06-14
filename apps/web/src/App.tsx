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
    question: '¿Qué publica Realstate en abierto?',
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
      <header className="sticky top-0 z-40 border-b border-border bg-carbon/95 text-textLight shadow-2xl shadow-petroleum/30 backdrop-blur-xl">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-mineral focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-textDark"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="group inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
            <span className="grid h-10 w-10 place-items-center border border-mineral/70 text-lg font-black text-mineral">R</span>
            <span className="text-lg font-black uppercase tracking-[0.22em] sm:text-xl">Realstate</span>
          </a>
          <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.18em] text-muted lg:flex">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <button type="button" aria-label="Idioma español seleccionado" className="border border-border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-muted">
              ES / EN
            </button>
            <a href="/inversores" className="border border-border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
              Acceso inversores
            </a>
          </div>
          <button
            ref={openButtonRef}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="grid h-11 w-11 place-items-center border border-border text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon lg:hidden"
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
        <div className="fixed inset-0 z-50 bg-carbon text-textLight lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación" ref={drawerRef}>
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <span className="text-lg font-black uppercase tracking-[0.22em]">Realstate</span>
            <button ref={closeButtonRef} type="button" aria-label="Cerrar menú" className="border border-border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover" onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="grid min-h-[calc(100dvh-73px)] content-between px-6 py-8">
            <nav aria-label="Navegación móvil" className="grid gap-5 text-3xl font-serif text-textLight">
              {navigation.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="border-b border-border pb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="grid gap-4">
              <div className="flex gap-3">
                <button type="button" aria-label="Idioma español seleccionado" className="border border-mineral bg-mineral px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-textDark focus:outline-none focus-visible:ring-2 focus-visible:ring-ivory">ES</button>
                <button type="button" aria-label="Cambiar idioma a inglés" className="border border-border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">EN</button>
              </div>
              <a href="/solicitar-acceso" onClick={() => setIsOpen(false)} className="border border-mineral bg-mineral px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textDark focus:outline-none focus-visible:ring-2 focus-visible:ring-ivory">Solicitar acceso</a>
              <a href="/inversores" onClick={() => setIsOpen(false)} className="border border-border px-5 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textLight focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Acceso inversores</a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[calc(100svh-73px)] overflow-hidden bg-carbon text-textLight">
      <picture>
        <source srcSet="/images/hero-architecture-640.webp 640w, /images/hero-architecture-1280.webp 1280w, /images/hero-architecture-1920.webp 1920w" sizes="100vw" type="image/webp" />
        <img src="/images/hero-architecture-1280.webp" alt="Composición arquitectónica urbana generada para Realstate con edificios al atardecer" width="1280" height="921" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-b from-carbon/85 via-carbon/80 to-carbon" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100svh-73px)] max-w-7xl flex-col justify-end px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <p className="mb-5 max-w-max border border-border bg-petroleum/70 px-3 py-2 text-xs font-black uppercase tracking-[0.26em] text-mineral backdrop-blur">
          Realstate — plataforma inmobiliaria privada
        </p>
        <h1 className="max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-textLight sm:text-6xl md:text-7xl lg:text-8xl">
          Inversión inmobiliaria con disciplina, datos y seguimiento operativo.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-muted sm:text-xl">
          Una base digital para presentar oportunidades, ordenar documentación y preparar una futura zona privada de inversores sin promesas grandilocuentes.
        </p>
        <div className="mt-8 grid gap-3 sm:flex">
          <a href="/oportunidades" className="group inline-flex items-center justify-center gap-3 bg-mineral px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
            Ver oportunidades demo <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
          </a>
          <a href="#firma" className="inline-flex items-center justify-center border border-border px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
            Nuestra firma
          </a>
        </div>
      </div>
    </section>
  );
}

function FirmNarrative() {
  return (
    <section id="firma" className="bg-ivory py-16 text-textDark sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-textDark">Sobre la firma</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
            Selección rigurosa antes que volumen.
          </h2>
        </div>
        <div className="space-y-7 text-lg leading-9 text-textDark/72">
          <p>
            Realstate se plantea como una plataforma inmobiliaria profesional para explicar una tesis, organizar oportunidades y comunicar avances con transparencia.
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
    <section id="tesis" className="bg-carbon py-16 text-textLight sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-mineral">Tesis de inversión</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
              Menos ruido, más trazabilidad.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-border bg-petroleum sm:grid-cols-2">
            {processIndicators.map((item) => (
              <div key={item} className="bg-carbon p-6">
                <span className="mb-5 block h-8 w-8 border border-mineral/70" aria-hidden="true" />
                <p className="text-xl font-semibold text-textLight">{item}</p>
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
    <section id="metodologia" className="bg-stone py-16 text-textDark sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-textDark">Metodología</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
            Una arquitectura tecnológica visible desde el primer contacto.
          </h2>
        </div>
        <div className="mt-10 grid gap-px border border-carbon/10 bg-carbon/10 lg:grid-cols-3">
          {methodology.map((item) => (
            <article key={item.title} className="bg-stone p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-textDark">{item.eyebrow}</p>
              <h3 className="mt-8 font-serif text-3xl tracking-[-0.03em]">{item.title}</h3>
              <p className="mt-5 leading-8 text-textDark/68">{item.text}</p>
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

  return (
    <article aria-label={`Oportunidad pública: ${opportunity.title}`} className="overflow-hidden border border-border bg-carbon text-textLight">
      {opportunity.primaryImage ? (
        <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="600" loading="lazy" className="h-52 w-full object-cover opacity-82" />
      ) : (
        <div className="h-52 w-full bg-gradient-to-br from-petroleum to-carbon" role="img" aria-label="Imagen pendiente de publicar" />
      )}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-mineral/50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-mineral">Datos ilustrativos</span>
          <span className="border border-border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted">{statusLabel(opportunity.status)}</span>
        </div>
        <h3 className="mt-5 font-serif text-3xl leading-tight tracking-[-0.03em]">{opportunity.title}</h3>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted">{location}</p>
        <p className="mt-4 leading-7 text-muted">{opportunity.shortDescription}</p>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-border bg-petroleum text-sm">
          <div className="bg-carbon p-3"><dt className="text-muted">{returnTypeLabel(opportunity.targetReturnType)}</dt><dd className="mt-1 font-serif text-2xl text-textLight">{opportunity.targetReturn.formatted ?? 'No publicado'}</dd></div>
          <div className="bg-carbon p-3"><dt className="text-muted">Plazo estimado</dt><dd className="mt-1 font-semibold">{opportunity.estimatedTermMonths} meses</dd></div>
          <div className="bg-carbon p-3"><dt className="text-muted">Ticket mínimo</dt><dd className="mt-1 font-semibold">{opportunity.minimumInvestment?.formatted ?? 'No publicado'}</dd></div>
          <div className="bg-carbon p-3"><dt className="text-muted">Capital objetivo</dt><dd className="mt-1 font-semibold">{opportunity.targetAmount?.formatted ?? 'No publicado'}</dd></div>
          <div className="bg-carbon p-3"><dt className="text-muted">Capital comprometido</dt><dd className="mt-1 font-semibold">{opportunity.committedAmount?.formatted ?? 'No publicado'}</dd></div>
          <div className="bg-carbon p-3"><dt className="text-muted">Nivel de riesgo</dt><dd className="mt-1 font-semibold">{riskLabel(opportunity.riskLevel)} · no regulatorio</dd></div>
        </dl>
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.18em] text-muted"><span>Financiación</span><span>{progress}% demo</span></div>
          <div className="h-2 bg-petroleum"><div className="h-2 bg-mineral" style={{ width: `${progress}%` }} /></div>
        </div>
        <a href={`/oportunidades/${opportunity.slug}`} className="mt-6 inline-flex border border-border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Ver oportunidad</a>
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
    <section id="oportunidades" className="bg-carbon py-16 text-textLight sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-mineral">Oportunidades actuales</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
              Información pública resumida desde PostgreSQL, sin exponer contenido privado.
            </h2>
          </div>
          <p className="leading-8 text-muted">
            Las oportunidades proceden de la API pública de Realstate. Los objetivos son estimaciones no garantizadas y no representan una oferta pública ni resultados pasados.
          </p>
        </div>

        {opportunitiesState.status === 'loading' ? (
          <div className="mt-10 border border-border bg-petroleum p-8 text-muted" role="status">Cargando oportunidades públicas…</div>
        ) : null}

        {opportunitiesState.status === 'error' ? (
          <div className="mt-10 border border-warning bg-petroleum p-8 text-muted" role="alert">No hemos podido cargar las oportunidades públicas. La API no está disponible temporalmente; no mostramos datos falsos como si fueran reales.</div>
        ) : null}

        {opportunitiesState.status === 'empty' ? (
          <div className="mt-10 border border-border bg-petroleum p-8 text-muted">No hay oportunidades públicas disponibles en este momento.</div>
        ) : null}

        {opportunitiesState.status === 'success' ? (
          <>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {opportunitiesState.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}
            </div>
            <p className="mt-6 text-sm leading-7 text-muted">{opportunitiesState.disclaimer}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-ivory py-16 text-textDark sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-textDark">FAQ</p>
        <h2 className="mt-5 font-serif text-4xl tracking-[-0.03em] sm:text-6xl">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-carbon/10 border-y border-carbon/10">
          {faqs.map((item) => (
            <details key={item.question} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">
                {item.question}
                <span aria-hidden="true" className="text-3xl text-textDark transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl leading-8 text-textDark/68">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function AccessCta() {
  return (
    <section id="acceso" className="bg-petroleum py-16 text-textLight sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-textLight">Acceso privado futuro</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-6xl">
            Preparado para documentación, hitos y seguimiento de inversores.
          </h2>
        </div>
        <div className="grid gap-3 sm:flex lg:grid">
          <a href="/solicitar-acceso" className="bg-mineral px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textDark transition hover:bg-mineralHover focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-petroleum">Solicitar acceso</a>
          <a href="/contacto" className="border border-border px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-textLight transition hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-petroleum">Contactar</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-carbon text-textLight" role="contentinfo">
      <div className="mx-auto grid max-w-7xl gap-8 border-t border-border px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="text-lg font-black uppercase tracking-[0.22em] text-textLight">Realstate</p>
          <p className="mt-3 max-w-xl">Plataforma inmobiliaria en construcción. Esta página usa datos demo y activos visuales generados específicamente para Realstate.</p>
        </div>
        <nav aria-label="Navegación secundaria" className="flex flex-wrap gap-4 font-semibold">
          {navigation.map((item) => <a key={item.href} className="hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover" href={item.href}>{item.label}</a>)}
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-carbon text-textDark antialiased">
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
