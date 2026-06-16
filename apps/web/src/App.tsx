import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fetchPublicOpportunities, returnTypeLabel, riskLabel, statusLabel, type PublicOpportunity } from './opportunities/api';
import { fetchLeadSettings, submitLead, type LeadCreated } from './leads/api';

const navigation = [
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Nuestra actividad', href: '/#actividad' },
  { label: 'Proyectos', href: '/#proyectos' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contacto', href: '/#contacto' }
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
    title: 'Nuestra actividad',
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

// ── Smooth scroll + header offset ──

function scrollToHash(hash: string) {
  const el = document.getElementById(hash.replace('#', ''));
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerHeight = 96;
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  el.style.outline = 'none';
  if (prefersReduced) {
    window.scrollTo(0, el.offsetTop - headerHeight);
  } else {
    window.scrollTo({ top: el.offsetTop - headerHeight, behavior: 'smooth' });
  }
}

function useHashScroll() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a[href^="/#"]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      const hashPart = href.slice(href.indexOf('#'));
      if (window.location.pathname === '/' || window.location.pathname === '') {
        event.preventDefault();
        history.replaceState(null, '', `/${hashPart}`);
        scrollToHash(hashPart);
      }
    }

    document.addEventListener('click', handleClick);

    if (window.location.hash) {
      requestAnimationFrame(() => scrollToHash(window.location.hash));
    }

    return () => document.removeEventListener('click', handleClick);
  }, []);
}

// ── Mobile menu ──

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
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 10); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = navigation.map((n) => n.href.replace('/#', ''));
    function onHashChange() { setActiveSection(window.location.hash.replace('#', '')); }
    onHashChange();
    window.addEventListener('hashchange', onHashChange);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActiveSection(entry.target.id); break; }
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-40 border-b bg-white transition-shadow ${
        scrolled ? 'border-frost/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'border-transparent'
      }`}>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-8 focus:top-6 focus:z-50 focus:bg-electric focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex h-24 max-w-[1440px] items-center px-8 lg:px-12">
          {/* Brand */}
          <a href="/" className="flex-shrink-0" style={{ maxWidth: 'min(280px, 25%)' }}>
            <span className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
              <span className="grid h-12 w-12 flex-shrink-0 place-items-center bg-electric text-sm font-black text-white">MC</span>
              <span className="grid leading-tight min-w-0">
                <span className="text-[19px] font-black uppercase tracking-[0.04em] text-ink truncate">MILLENNIALS CONSTRUYEN</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-charcoal/50 hidden lg:block">Private Real Estate Investment Club</span>
              </span>
            </span>
          </a>

          {/* Nav center */}
          <nav aria-label="Navegación principal" className="hidden lg:flex flex-1 items-center justify-center gap-8 xl:gap-9">
            {navigation.map((item) => {
              const sectionId = item.href.replace('/#', '');
              const isActive = activeSection === sectionId;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`relative whitespace-nowrap pb-[2px] text-[12px] font-semibold tracking-[0.06em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                    isActive ? 'text-electric' : 'text-charcoal/55 hover:text-electric'
                  }`}
                >
                  {item.label}
                  {isActive ? <span className="absolute bottom-[-21px] left-0 right-0 h-[2px] bg-electric" /> : null}
                </a>
              );
            })}
          </nav>

          {/* Right: Lang + CTA */}
          <div className="hidden lg:flex flex-shrink-0 items-center gap-6">
            <button type="button" aria-label="Idioma español seleccionado" className="text-[12px] font-semibold uppercase tracking-[0.10em] text-charcoal/55 hover:text-electric transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
              <span className="text-electric font-bold">ES</span> · EN
            </button>
            <a href="/coinvierte" className="inline-flex h-[46px] items-center rounded-md border border-charcoal/25 bg-ink px-6 text-[12px] font-bold tracking-[0.06em] text-white transition hover:bg-electric hover:border-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
              Coinvierte con nosotros
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={openButtonRef}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="ml-auto grid h-10 w-10 place-items-center text-ink transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric lg:hidden"
            onClick={() => setIsOpen(true)}
          >
            <span aria-hidden="true" className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-white text-ink lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación" ref={drawerRef}>
          <div className="flex items-center justify-between border-b border-frost px-6 py-4">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center bg-electric text-sm font-black text-white">MC</span>
              <span className="text-base font-black uppercase tracking-[0.04em]">MILLENNIALS CONSTRUYEN</span>
            </span>
            <button ref={closeButtonRef} type="button" aria-label="Cerrar menú" className="rounded-md border border-frost px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="grid min-h-[calc(100dvh-65px)] content-between px-8 py-8">
            <nav aria-label="Navegación móvil" className="grid gap-4 text-2xl font-serif text-ink">
              {navigation.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="border-b border-frost pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 text-sm font-semibold uppercase tracking-[0.10em] text-charcoal/55">
                <span className="text-electric font-bold">ES</span> · EN
              </div>
              <a href="/coinvierte" onClick={() => setIsOpen(false)} className="rounded-md bg-electric px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Coinvierte con nosotros</a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Hero ──

function Hero() {
  return (
    <section className="relative overflow-hidden bg-lavender">
      <div className="relative mx-auto flex max-w-[1440px] flex-col justify-center px-8 py-16 sm:px-12 lg:px-12 lg:py-20">
        <p className="mb-5 max-w-max border border-electric/20 bg-electric/5 px-3 py-2 text-xs font-black uppercase tracking-[0.26em] text-electric">
          Club privado de inversión inmobiliaria
        </p>
        <h1 className="max-w-[1100px] font-serif text-5xl leading-[0.95] tracking-[-0.04em] text-ink sm:text-6xl md:text-7xl lg:text-8xl">
          Invertir bien empieza por seleccionar mejor.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-charcoal/80 sm:text-lg">
          Seleccionamos proyectos capaces de generar valor mediante una estrategia inmobiliaria definida y una ejecución disciplinada.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="/#coinvierte" className="inline-flex items-center justify-center bg-electric px-6 py-3.5 text-sm font-bold tracking-[0.12em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-4 focus-visible:ring-offset-lavender">
            Coinvierte con nosotros
          </a>
          <a href="/#proyectos" className="inline-flex items-center justify-center border border-charcoal/15 px-6 py-3.5 text-sm font-bold tracking-[0.12em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-4 focus-visible:ring-offset-lavender">
            Ver proyectos
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Nosotros ──

function FirmNarrative() {
  return (
    <section id="nosotros" className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Nosotros</p>
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

// ── Nuestra actividad ──

function ProcessSection() {
  return (
    <section id="actividad" className="bg-lavender py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Nuestra actividad</p>
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

// ── Cómo trabajamos ──

function Methodology() {
  return (
    <section id="como-trabajamos" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Cómo trabajamos</p>
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

// ── Opportunity card ──

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
        <a href={`/proyectos/${opportunity.slug}`} className="mt-6 inline-flex rounded-lg border border-frost px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-ink transition hover:border-electric hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">Ver proyecto</a>
      </div>
    </article>
  );
}

// ── Proyectos (3 Vigo cards, no filters/search/pagination) ──

function usePublicOpportunities() {
  const [state, setState] = useState<{
    status: 'loading' | 'success' | 'error' | 'empty';
    data: PublicOpportunity[];
    disclaimer: string | null;
  }>({ status: 'loading', data: [], disclaimer: null });

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

function ProjectsSection() {
  const state = usePublicOpportunities();

  return (
    <section id="proyectos" className="bg-lavender py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Proyectos destacados</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
              Información pública resumida desde PostgreSQL, sin exponer contenido privado.
            </h2>
          </div>
          <p className="leading-8 text-charcoal/80">
            Las oportunidades proceden de la API pública de MILLENNIALS CONSTRUYEN. Los objetivos son estimaciones no garantizadas y no representan una oferta pública ni resultados pasados.
          </p>
        </div>

        {state.status === 'loading' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60" role="status">Cargando proyectos…</div>
        ) : null}

        {state.status === 'error' ? (
          <div className="mt-10 rounded-lg border border-warning/40 bg-warning/5 p-8 text-charcoal/80" role="alert">No hemos podido cargar los proyectos públicos. La API no está disponible temporalmente; no mostramos datos falsos como si fueran reales.</div>
        ) : null}

        {state.status === 'empty' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60">No hay proyectos públicos disponibles en este momento.</div>
        ) : null}

        {state.status === 'success' ? (
          <>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {state.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}
            </div>
            <p className="mt-6 text-sm leading-7 text-charcoal/60">{state.disclaimer}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

// ── FAQ ──

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

// ── Contacto (integrated form) ──

type Errors = Record<string, string>;

function ContactSection() {
  const mountedAt = useRef(Date.now());
  const errorRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<LeadCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const settings = useRef<{ enabled: boolean } | null>(null);
  const [disabled, setDisabled] = useState<string | null>(null);

  useEffect(() => {
    fetchLeadSettings(new AbortController().signal)
      .then((s) => { settings.current = s; if (!s.enabled) setDisabled('Las solicitudes todavía no están habilitadas porque faltan datos legales reales del responsable o el canal de privacidad.'); })
      .catch(() => setDisabled('Las solicitudes todavía no están habilitadas porque faltan datos legales reales del responsable o el canal de privacidad.'));
  }, []);

  useEffect(() => { if (Object.keys(errors).length) errorRef.current?.focus(); }, [errors]);

  function validate(form: HTMLFormElement): { data?: FormData; errors: Errors } {
    const data = new FormData(form);
    const next: Errors = {};
    for (const name of ['firstName', 'lastName', 'email']) if (!String(data.get(name) ?? '').trim()) next[name] = 'Campo obligatorio.';
    if (!String(data.get('email') ?? '').includes('@')) next.email = 'Introduce un email válido.';
    if (String(data.get('message') ?? '').length > 2000) next.message = 'El mensaje no puede superar 2000 caracteres.';
    if (data.get('privacyAccepted') !== 'on') next.privacyAccepted = 'Debes aceptar la información de privacidad para que podamos responder.';
    if (String(data.get('website') ?? '').trim()) next.website = 'No se pudo procesar la solicitud.';
    return { data, errors: next };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors: nextErrors } = validate(form);
    setErrors(nextErrors);
    if (!data || Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const search = new URLSearchParams(window.location.search);
      const created = await submitLead({
        kind: 'general_contact',
        firstName: String(data.get('firstName') ?? ''),
        lastName: String(data.get('lastName') ?? ''),
        email: String(data.get('email') ?? ''),
        phone: String(data.get('phone') ?? '') || undefined,
        countryCode: String(data.get('countryCode') ?? '') || undefined,
        message: String(data.get('message') ?? '') || undefined,
        sourcePath: window.location.pathname,
        referrer: document.referrer || undefined,
        utmSource: search.get('utm_source') ?? undefined,
        utmMedium: search.get('utm_medium') ?? undefined,
        utmCampaign: search.get('utm_campaign') ?? undefined,
        privacyAccepted: true,
        marketingOptIn: data.get('marketingOptIn') === 'on',
        submittedAfterMs: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? '')
      });
      setResult(created);
      form.reset();
    } catch (error) {
      const message = error instanceof Error && error.message === 'disabled'
        ? 'La captación todavía no está habilitada. No hemos guardado la solicitud.'
        : error instanceof Error && error.message === 'rate_limited'
          ? 'Demasiados intentos. Inténtalo más tarde.'
          : 'No hemos podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.';
      setErrors({ form: message });
    } finally { setSubmitting(false); }
  }

  return (
    <section id="contacto" className="bg-lavender py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Contacto</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
              Contactar con MILLENNIALS CONSTRUYEN
            </h2>
            <p className="mt-5 text-lg leading-8 text-charcoal/80">
              Usa este canal para consultas generales sobre la firma o la plataforma.
            </p>
          </div>
          <div className="rounded-lg border border-frost bg-white p-5">
            {disabled ? <div role="status" className="border border-warning/40 bg-warning/5 p-4 text-sm font-bold text-charcoal/80">{disabled}</div> : null}
            {Object.keys(errors).length ? <div ref={errorRef} tabIndex={-1} role="alert" className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4"><p className="font-bold text-charcoal/80">Revisa el formulario</p><ul className="mt-2 list-disc pl-5 text-charcoal/80">{Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}</ul></div> : null}
            {result ? <div role="status" className="mt-4 rounded-lg border border-frost bg-white p-4"><p className="font-bold text-ink">Solicitud recibida</p><p className="text-sm text-charcoal/80">Referencia pública: <strong>{result.publicReference}</strong></p><p className="text-sm text-charcoal/80">{result.message}</p></div> : null}
            <form className="mt-5 grid gap-4" onSubmit={onSubmit} noValidate>
              <div className="hidden" aria-hidden="true"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <label className="grid gap-1 text-sm font-bold text-ink">Nombre<input name="firstName" className="min-h-11 rounded-lg border border-frost px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" autoComplete="given-name" disabled={Boolean(disabled) || submitting} /></label>
              <label className="grid gap-1 text-sm font-bold text-ink">Apellidos<input name="lastName" className="min-h-11 rounded-lg border border-frost px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" autoComplete="family-name" disabled={Boolean(disabled) || submitting} /></label>
              <label className="grid gap-1 text-sm font-bold text-ink">Email<input name="email" type="email" className="min-h-11 rounded-lg border border-frost px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" autoComplete="email" disabled={Boolean(disabled) || submitting} /></label>
              <label className="grid gap-1 text-sm font-bold text-ink">Teléfono opcional<input name="phone" className="min-h-11 rounded-lg border border-frost px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" autoComplete="tel" disabled={Boolean(disabled) || submitting} /></label>
              <label className="grid gap-1 text-sm font-bold text-ink">Mensaje opcional<textarea name="message" rows={4} maxLength={2000} className="rounded-lg border border-frost px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" disabled={Boolean(disabled) || submitting} /></label>
              <label className="flex gap-3 text-sm text-charcoal/80"><input name="privacyAccepted" type="checkbox" disabled={Boolean(disabled) || submitting} /> <span>Acepto la <Link to="/privacidad" className="underline hover:text-electric">información de privacidad provisional</Link> para que MILLENNIALS CONSTRUYEN pueda responder.</span></label>
              <label className="flex gap-3 text-sm text-charcoal/80"><input name="marketingOptIn" type="checkbox" disabled={Boolean(disabled) || submitting} /> <span>Acepto recibir comunicaciones comerciales futuras. Opcional y separado.</span></label>
              <button type="submit" disabled={Boolean(disabled) || submitting} className="rounded-lg bg-electric px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">{submitting ? 'Enviando…' : 'Enviar consulta'}</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Coinvierte CTA ──

function AccessCta() {
  return (
    <section id="coinvierte" className="bg-electric py-16 text-white sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/70">Coinvierte con nosotros</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-white sm:text-6xl">
            Preparado para documentación, hitos y seguimiento de inversores.
          </h2>
        </div>
        <div className="grid gap-3 sm:flex lg:grid">
          <a href="/coinvierte" className="bg-white px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-electric transition hover:bg-frost focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-electric">Coinvierte con nosotros</a>
          <a href="/#contacto" className="border border-white/30 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:border-white hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-electric">Contactar</a>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──

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

// ── App ──

export function App() {
  useHashScroll();

  return (
    <div className="min-h-screen bg-lavender text-ink antialiased">
      <Header />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <FirmNarrative />
        <ProcessSection />
        <Methodology />
        <ProjectsSection />
        <Faq />
        <ContactSection />
        <AccessCta />
      </main>
      <Footer />
    </div>
  );
}
