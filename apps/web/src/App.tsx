import { FormEvent, useEffect, useRef, useState } from 'react';
import { fetchPublicOpportunities, returnTypeLabel, riskLabel, statusLabel, type PublicOpportunity } from './opportunities/api';
import { submitContact, submitCoinvest, type ContactCreated, type CoinvestCreated } from './leads/api';

const navigation = [
  { label: 'Proyectos', href: '/#proyectos' },
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Cómo trabajamos', href: '/#metodologia' },
  { label: 'Contacto', href: '/#contacto' }
];

const drawerLinks = [
  { label: 'Proyectos', href: '/#proyectos' },
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Cómo trabajamos', href: '/#metodologia' },
  { label: 'Contacto', href: '/#contacto' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Coinvierte', href: '/#coinvierte' }
];

const activityBlocks = [
  { number: '01', title: 'Selección rigurosa', desc: 'Evaluamos cada oportunidad antes de incorporarla a nuestra cartera de proyectos.' },
  { number: '02', title: 'Análisis integral', desc: 'Realizamos una due diligence técnica, jurídica, comercial y financiera para identificar los principales riesgos y validar los supuestos de cada proyecto.' },
  { number: '03', title: 'Estructuración de la operación', desc: 'Definimos la estrategia, el horizonte y el marco de inversión de cada proyecto.' },
  { number: '04', title: 'Documentación clara', desc: 'Ordenamos la información relevante para facilitar una evaluación comprensible.' },
  { number: '05', title: 'Seguimiento operativo', desc: 'Monitorizamos hitos, riesgos y posibles desviaciones durante la ejecución.' },
  { number: '06', title: 'Comunicación periódica', desc: 'Compartimos los avances de cada proyecto de forma estructurada y transparente.' }
];

const methodology = [
  {
    eyebrow: '01',
    title: 'Analizamos la oportunidad',
    text: 'Estudiamos la ubicación, la demanda, el activo, los costes, los riesgos y el escenario de salida antes de avanzar.'
  },
  {
    eyebrow: '02',
    title: 'Estructuramos la inversión',
    text: 'Definimos la estrategia, el horizonte, la documentación y las condiciones necesarias para comprender cada operación.'
  },
  {
    eyebrow: '03',
    title: 'Acompañamos la ejecución',
    text: 'Seguimos los hitos, las posibles desviaciones y la evolución del proyecto, comunicando sus avances de forma periódica.'
  }
];

const faqs = [
  {
    question: '¿Qué es MILLENNIALS CONSTRUYEN?',
    answer: 'Es un club privado de coinversión inmobiliaria que selecciona, analiza y estructura oportunidades con una estrategia definida y un seguimiento activo de su ejecución.'
  },
  {
    question: '¿Cómo se accede al club?',
    answer: 'El acceso no es automático. Cada solicitud se revisa para conocer el perfil, los intereses y la adecuación del potencial coinversor. La incorporación está sujeta a invitación o validación previa.'
  },
  {
    question: '¿Cómo se seleccionan los proyectos?',
    answer: 'Analizamos cada oportunidad desde una perspectiva técnica, jurídica, comercial y financiera. Solo avanzamos con aquellos proyectos que superan nuestros criterios de selección y presentan una estrategia comprensible.'
  },
  {
    question: '¿Qué es la due diligence de un proyecto?',
    answer: 'Es una revisión previa destinada a contrastar la información disponible, validar los principales supuestos e identificar riesgos. La due diligence reduce la incertidumbre, pero no elimina los riesgos propios de una inversión inmobiliaria.'
  },
  {
    question: '¿La rentabilidad está garantizada?',
    answer: 'No. Toda inversión inmobiliaria implica riesgos y puede producir pérdidas. Las cifras, objetivos o escenarios que se presenten son estimaciones, no resultados garantizados.'
  },
  {
    question: '¿Cómo puedo mostrar mi interés en coinvertir?',
    answer: 'Puedes completar la solicitud de la sección Coinvierte. Revisaremos la información facilitada y, si existe encaje, contactaremos contigo para explicarte los siguientes pasos. Enviar la solicitud no implica ningún compromiso de inversión.'
  }
];

// ── Smooth scroll + header offset ──

function scrollToHash(hash: string) {
  const el = document.getElementById(hash.replace('#', ''));
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerHeight = 80;
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
  const [activeSection, setActiveSection] = useState('');

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
      <header className="sticky top-0 z-40 border-b border-frost bg-white">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-50 focus:bg-electric focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
        >
          Saltar al contenido
        </a>
        <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-4 px-5 sm:px-6 lg:px-8">
          {/* Brand */}
          <a href="/" className="flex flex-shrink-0 items-center gap-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
            <span className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center bg-electric text-[15px] font-black text-white select-none">MC</span>
            <span className="hidden text-[18px] font-bold tracking-[0.02em] text-ink select-none sm:inline lg:text-[19px]">MILLENNIALS CONSTRUYEN</span>
          </a>

          {/* Nav */}
          <nav aria-label="Navegación principal" className="hidden xl:flex flex-1 items-center justify-center gap-8">
            {navigation.map((item) => {
              const sectionId = item.href.replace('/#', '');
              const isActive = activeSection === sectionId;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`relative text-[14px] font-medium tracking-[0.02em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                    isActive ? 'text-electric' : 'text-charcoal/55 hover:text-electric'
                  }`}
                >
                  {item.label}
                  {isActive ? <span className="absolute -bottom-[24px] left-1/2 h-[2px] w-8 -translate-x-1/2 bg-electric" /> : null}
                </a>
              );
            })}
          </nav>

          {/* Right zone: Lang + Login */}
          <div className="hidden xl:flex flex-shrink-0 items-center gap-5">
            <button type="button" aria-label="Idioma español seleccionado" className="text-[13px] font-medium text-charcoal/55 hover:text-electric transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
              <span className="text-electric font-semibold">ES</span> · EN
            </button>
            <a href="/acceso" className="inline-flex h-10 w-[100px] items-center justify-center rounded bg-ink text-[14px] font-semibold text-white transition hover:bg-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
              Login
            </a>
          </div>

          {/* Hamburger */}
          <button
            ref={openButtonRef}
            type="button"
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="ml-auto grid h-10 w-10 flex-shrink-0 place-items-center text-ink transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric xl:hidden"
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

      {/* Drawer */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-white text-ink xl:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación" ref={drawerRef}>
          <div className="flex items-center justify-between border-b border-frost px-6 py-4">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center bg-electric text-sm font-black text-white">MC</span>
              <span className="text-base font-bold uppercase tracking-[0.02em]">MILLENNIALS CONSTRUYEN</span>
            </span>
            <button ref={closeButtonRef} type="button" aria-label="Cerrar menú" className="rounded border border-frost px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
          <div className="grid min-h-[calc(100dvh-65px)] content-between px-8 py-8">
            <nav aria-label="Navegación móvil" className="grid gap-4 text-2xl font-serif text-ink">
              {drawerLinks.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="border-b border-frost pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 text-[14px] font-medium text-charcoal/55">
                <span className="text-electric font-semibold">ES</span> · EN
              </div>
              <a href="/acceso" onClick={() => setIsOpen(false)} className="rounded bg-electric px-6 py-4 text-center text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
                Login
              </a>
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
          <h2 className="mt-5 max-w-[20ch] font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl lg:text-6xl">
            Pocas oportunidades. Mucho criterio.
          </h2>
        </div>
        <div className="space-y-6 text-lg leading-9 text-charcoal/80">
          <p>
            Somos un club privado de inversión inmobiliaria que selecciona y estructura proyectos con una visión clara: entender bien cada operación antes de tomar una decisión.
          </p>
          <p>
            Preferimos analizar pocas oportunidades en profundidad, evaluar sus riesgos y acompañar su ejecución con disciplina, transparencia y una perspectiva de largo plazo.
          </p>
          <p className="border-t border-electric/30 pt-5 text-base leading-7 font-semibold text-charcoal/70">
            El acceso al club es privado y está sujeto a invitación o validación previa.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Nuestra actividad ──

function ProcessSection() {
  return (
    <section id="actividad" className="bg-lavender py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Nuestra actividad</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
              Del análisis a la ejecución.
            </h2>
            <p className="mt-5 max-w-prose leading-8 text-charcoal/80">
              Seleccionamos, estructuramos y seguimos cada proyecto con una visión inmobiliaria, financiera y operativa.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-frost bg-frost sm:grid-cols-2 lg:grid-cols-3">
            {activityBlocks.map((block) => (
              <div key={block.number} className="flex flex-col bg-white p-[22px] sm:p-6">
                <p className="text-sm font-black tracking-[0.16em] text-electric">{block.number}</p>
                <h3 className="mt-2 font-serif text-xl tracking-[-0.02em] text-ink">{block.title}</h3>
                <p className="mt-1.5 text-[15px] leading-snug text-charcoal/70">{block.desc}</p>
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
            De la oportunidad al seguimiento.
          </h2>
          <p className="mt-5 max-w-prose leading-8 text-charcoal/80">
            Aplicamos un proceso claro para analizar cada proyecto, estructurar la inversión y acompañar su ejecución.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-frost bg-frost lg:grid-cols-3">
          {methodology.map((item) => (
            <article key={item.title} className="flex flex-col bg-white p-6 sm:p-7">
              <p className="text-sm font-black tracking-[0.16em] text-electric">{item.eyebrow}</p>
              <h3 className="mt-3 font-serif text-2xl tracking-[-0.02em] text-ink">{item.title}</h3>
              <p className="mt-2 leading-7 text-charcoal/70">{item.text}</p>
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
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-frost bg-white transition hover:border-electric/30 focus-within:border-electric/30">
      <div className="relative aspect-[4/3] overflow-hidden bg-electric/5">
        {opportunity.primaryImage ? (
          <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="675" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
        ) : (
          <div className="h-full w-full" role="img" aria-label="Imagen pendiente de publicar" />
        )}
        {!opportunity.primaryImage ? <span className="absolute bottom-2 right-2 bg-ink/50 px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm">IMAGEN PROVISIONAL</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="border border-electric/25 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-electric">{statusLabel(opportunity.status)}</span>
          {isFunded ? <span className="border border-electric/25 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-electric">Financiación cerrada</span> : null}
          {opportunity.strategy === 'Cambio de uso' ? <span className="border border-frost px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-charcoal/50">Cambio de uso</span> : null}
        </div>
        <h3 className="mt-4 font-serif text-2xl leading-tight tracking-[-0.02em] text-ink line-clamp-3">{opportunity.title}</h3>
        <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.16em] text-charcoal/50">{location}</p>
        <p className="mt-3 leading-7 text-charcoal/70 line-clamp-4">{opportunity.shortDescription}</p>
        {showFinancials ? (
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-frost bg-frost text-sm">
            <div className="bg-white p-3"><dt className="text-charcoal/60">{returnTypeLabel(opportunity.targetReturnType)}</dt><dd className="mt-1 font-serif text-2xl text-ink">{opportunity.targetReturn.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Plazo estimado</dt><dd className="mt-1 font-semibold text-ink">{opportunity.estimatedTermMonths} meses</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Ticket mínimo</dt><dd className="mt-1 font-semibold text-ink">{opportunity.minimumInvestment?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Capital objetivo</dt><dd className="mt-1 font-semibold text-ink">{opportunity.targetAmount?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Capital comprometido</dt><dd className="mt-1 font-semibold text-ink">{opportunity.committedAmount?.formatted ?? '—'}</dd></div>
            <div className="bg-white p-3"><dt className="text-charcoal/60">Nivel de riesgo</dt><dd className="mt-1 font-semibold text-ink">{riskLabel(opportunity.riskLevel)} · no regulatorio</dd></div>
          </dl>
        ) : null}
        {showProgress ? (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.16em] text-charcoal/50"><span>Financiación</span><span>Capital cubierto · {progress}%</span></div>
            <div className="h-1.5 rounded-full bg-frost"><div className="h-1.5 rounded-full bg-electric" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : null}
        <div className="mt-auto pt-5">
          <a href={`/proyectos/${opportunity.slug}`} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-ink transition group-hover:text-electric focus:outline-none">
            Ver proyecto <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
      <a href={`/proyectos/${opportunity.slug}`} className="absolute inset-0 z-10" aria-label={`Ver proyecto: ${opportunity.title}`}>
        <span className="sr-only">Ver proyecto: {opportunity.title}</span>
      </a>
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
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Proyectos seleccionados</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
            Proyectos con una estrategia clara desde el inicio.
          </h2>
          <p className="mt-5 max-w-prose leading-8 text-charcoal/80">
            Presentamos una selección de oportunidades inmobiliarias analizadas y estructuradas para comprender su situación, su estrategia y sus principales riesgos.
          </p>
        </div>

        {state.status === 'loading' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60" role="status">Cargando proyectos…</div>
        ) : null}

        {state.status === 'error' ? (
          <div className="mt-10 rounded-lg border border-warning/40 bg-warning/5 p-8 text-charcoal/80" role="alert">No hemos podido cargar los proyectos en este momento. No mostramos datos falsos como si fueran reales.</div>
        ) : null}

        {state.status === 'empty' ? (
          <div className="mt-10 rounded-lg border border-frost bg-white p-8 text-charcoal/60">No hay proyectos disponibles en este momento.</div>
        ) : null}

        {state.status === 'success' ? (
          <>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {state.data.map((opportunity) => <OpportunityCard key={opportunity.slug} opportunity={opportunity} />)}
            </div>
            <p className="mt-8 text-sm leading-7 text-charcoal/50 max-w-3xl">{state.disclaimer}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}

// ── FAQ ──

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-[880px] px-4 sm:px-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">FAQ</p>
        <h2 className="mt-5 font-serif text-4xl tracking-[-0.03em] text-ink sm:text-6xl">Preguntas frecuentes</h2>
        <div className="mt-8 divide-y divide-frost border-y border-frost">
          {faqs.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-lg font-semibold text-ink transition hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                  >
                    {item.question}
                    <span aria-hidden="true" className="flex-shrink-0 text-xl text-electric/70 transition-transform" style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                      +
                    </span>
                  </button>
                </h3>
                {isOpen ? (
                  <div className="pb-5 pr-10 leading-7 text-charcoal/70">
                    {item.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Contacto (integrated form) ──

const CONTACT_SUBJECTS = ['Consulta general', 'Presentar un proyecto', 'Colaboración profesional', 'Otro'] as const;

type Errors = Record<string, string>;

function ContactSection() {
  const mountedAt = useRef(Date.now());
  const successRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<ContactCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(form: HTMLFormElement): { data?: FormData; errors: Errors } {
    const data = new FormData(form);
    const next: Errors = {};
    if (!String(data.get('name') ?? '').trim()) next.name = 'Campo obligatorio.';
    const email = String(data.get('email') ?? '').trim();
    if (!email) next.email = 'Campo obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Introduce un email válido.';
    if (!data.get('subject')) next.subject = 'Selecciona un motivo.';
    const message = String(data.get('message') ?? '').trim();
    if (!message) next.message = 'Campo obligatorio.';
    else if (message.length < 20) next.message = 'El mensaje debe tener al menos 20 caracteres.';
    else if (message.length > 2000) next.message = 'El mensaje no puede superar 2000 caracteres.';
    if (data.get('consent') !== 'on') next.consent = 'Debes aceptar el uso de tus datos para atender esta consulta.';
    if (String(data.get('website') ?? '').trim()) next.website = 'No se pudo procesar la solicitud.';
    return { data, errors: next };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors: nextErrors } = validate(form);
    setErrors(nextErrors);
    setResult(null);
    if (!data || Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const created = await submitContact({
        name: String(data.get('name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        phone: String(data.get('phone') ?? '').trim() || undefined,
        subject: String(data.get('subject') ?? '') as typeof CONTACT_SUBJECTS[number],
        message: String(data.get('message') ?? '').trim(),
        consent: true,
        submittedAfterMs: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? '')
      });
      setResult(created);
      form.reset();
      requestAnimationFrame(() => { successRef.current?.focus(); });
    } catch (error) {
      const message = error instanceof Error && error.message === 'rate_limited'
        ? 'Demasiados intentos. Inténtalo más tarde.'
        : 'No hemos podido enviar el mensaje. Revisa los datos e inténtalo de nuevo.';
      setErrors({ form: message });
    } finally { setSubmitting(false); }
  }

  return (
    <section id="contacto" className="bg-lavender py-10 sm:py-14">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Single integrated container */}
        <div className="overflow-hidden rounded-lg border border-frost bg-white shadow-sm lg:grid lg:grid-cols-[38%_62%] lg:rounded-xl">
          {/* ── Left column · dark ── */}
          <div className="flex items-center bg-ink px-8 py-10 text-white lg:px-12 lg:py-12">
            <div className="max-w-prose">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Contacto</p>
              <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-[48px] sm:leading-[1.1] lg:text-[52px] lg:leading-[1.08]">
                Conversemos.
              </h2>
              <p className="mt-5 leading-7 text-white/80">
                Para consultas generales, colaboraciones o propuestas inmobiliarias, envíanos un mensaje. Revisaremos tu solicitud y responderemos personalmente.
              </p>
              <p className="mt-4 text-sm leading-6 text-white/60">
                Para solicitar acceso como coinversor, utiliza la sección{' '}
                <a href="/#coinvierte" className="font-semibold text-electric underline hover:text-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Coinvierte</a>.
              </p>
            </div>
          </div>

          {/* ── Right column · form ── */}
          <div className="p-6 sm:p-8 lg:p-10">
            {Object.keys(errors).length ? (
              <div role="alert" tabIndex={-1} className="mb-5 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <p className="font-bold text-charcoal/80">Revisa el formulario</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-charcoal/80">
                  {Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            ) : null}
            {result ? (
              <div ref={successRef} role="status" tabIndex={-1} className="mb-5 rounded-lg border border-frost bg-white p-4">
                <p className="font-bold text-ink">Mensaje enviado</p>
                <p className="mt-1 text-sm leading-6 text-charcoal/80">{result.message}</p>
              </div>
            ) : null}
            <form className="grid gap-[18px]" onSubmit={onSubmit} noValidate>
              <div className="hidden" aria-hidden="true">
                <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>

              {/* Row 1: Nombre + Email */}
              <div className="grid gap-[18px] sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Nombre *</span>
                  <input name="name" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="name" maxLength={100} disabled={submitting} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Email *</span>
                  <input name="email" type="email" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="email" maxLength={254} disabled={submitting} required />
                </label>
              </div>

              {/* Row 2: Teléfono + Motivo */}
              <div className="grid gap-[18px] sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Teléfono (opcional)</span>
                  <input name="phone" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="tel" maxLength={30} disabled={submitting} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Motivo *</span>
                  <select name="subject" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" disabled={submitting} required>
                    <option value="">Selecciona una opción</option>
                    {CONTACT_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              {/* Full width: Mensaje */}
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-ink">Mensaje *</span>
                <textarea name="message" rows={5} maxLength={2000} minLength={20} className="min-h-[120px] rounded-lg border border-frost bg-white px-3 py-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" disabled={submitting} required />
              </label>

              {/* Consent + note */}
              <div>
                <label className="flex items-start gap-2.5 text-sm leading-6 text-charcoal/80">
                  <input name="consent" type="checkbox" className="mt-[0.35em] h-4 w-4 flex-shrink-0 accent-electric" disabled={submitting} required />
                  <span>Acepto que los datos facilitados se utilicen exclusivamente para atender esta consulta.</span>
                </label>
                <p className="mt-1.5 pl-[26px] text-xs leading-5 text-charcoal/50">
                  No utilizaremos estos datos para comunicaciones comerciales sin consentimiento adicional.
                </p>
              </div>

              {/* Button — right-aligned, constrained width */}
              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="h-12 w-full rounded-lg bg-electric px-6 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 sm:w-[220px]">
                  {submitting ? 'Enviando…' : 'Enviar mensaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Coinvierte section ──

const COINVEST_PROFILES = ['Inversor particular', 'Empresa', 'Family office', 'Profesional del sector', 'Otro'] as const;
const COINVEST_EXPERIENCES = ['Sin experiencia previa', 'Alguna inversión previa', 'Experiencia habitual', 'Prefiero no indicarlo'] as const;

type CvErrors = Record<string, string>;

function CoinvestSection() {
  const mountedAt = useRef(Date.now());
  const successRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<CvErrors>({});
  const [result, setResult] = useState<CoinvestCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(form: HTMLFormElement): { data?: FormData; errors: CvErrors } {
    const data = new FormData(form);
    const next: CvErrors = {};
    if (!String(data.get('name') ?? '').trim()) next.name = 'Campo obligatorio.';
    const email = String(data.get('email') ?? '').trim();
    if (!email) next.email = 'Campo obligatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Introduce un email válido.';
    if (!data.get('profile')) next.profile = 'Selecciona un perfil.';
    if (!data.get('experience')) next.experience = 'Selecciona una opción.';
    const interests = String(data.get('interests') ?? '').trim();
    if (interests.length > 1000) next.interests = 'Máximo 1.000 caracteres.';
    if (data.get('consent') !== 'on') next.consent = 'Debes aceptar el uso de tus datos para evaluar la solicitud.';
    if (String(data.get('website') ?? '').trim()) next.website = 'No se pudo procesar la solicitud.';
    return { data, errors: next };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, errors: nextErrors } = validate(form);
    setErrors(nextErrors);
    setResult(null);
    if (!data || Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const created = await submitCoinvest({
        name: String(data.get('name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        phone: String(data.get('phone') ?? '').trim() || undefined,
        profile: String(data.get('profile') ?? '') as typeof COINVEST_PROFILES[number],
        experience: String(data.get('experience') ?? '') as typeof COINVEST_EXPERIENCES[number],
        interests: String(data.get('interests') ?? '').trim() || undefined,
        consent: true,
        submittedAfterMs: Date.now() - mountedAt.current,
        website: String(data.get('website') ?? '')
      });
      setResult(created);
      form.reset();
    } catch (error) {
      const message = error instanceof Error && error.message === 'rate_limited'
        ? 'Demasiados intentos. Inténtalo más tarde.'
        : 'No hemos podido enviar la solicitud. Revisa los datos e inténtalo de nuevo.';
      setErrors({ form: message });
    } finally { setSubmitting(false); }
  }

  // Focus success message when it appears
  useEffect(() => {
    if (result) successRef.current?.focus();
  }, [result]);

  return (
    <section id="coinvierte" className="bg-ink py-10 sm:py-14">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Single integrated container */}
        <div className="overflow-hidden rounded-lg bg-charcoal lg:grid lg:grid-cols-[52%_48%] lg:rounded-xl">
          {/* ── Left column · editorial ── */}
          <div className="flex items-center px-8 py-10 text-white lg:px-12 lg:py-12">
            <div className="max-w-prose">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Coinvierte con nosotros</p>
              <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-[44px] sm:leading-[1.12] lg:text-[48px] lg:leading-[1.1]">
                Accede a oportunidades seleccionadas con criterio.
              </h2>
              <p className="mt-5 leading-7 text-white/80">
                El acceso al club no es automático. Revisamos cada solicitud para conocer el perfil, los intereses y la adecuación de cada potencial coinversor.
              </p>
              <p className="mt-3 leading-7 text-white/70">
                Cuando exista encaje, compartiremos contigo los siguientes pasos y la información disponible sobre futuras oportunidades.
              </p>

              {/* Process steps */}
              <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-8">
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex-shrink-0 text-sm font-black text-electric">01</span>
                  <div>
                    <p className="text-sm font-bold text-white">Solicitud</p>
                    <p className="mt-0.5 text-sm leading-6 text-white/60">Cuéntanos brevemente quién eres y qué tipo de oportunidades te interesan.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex-shrink-0 text-sm font-black text-electric">02</span>
                  <div>
                    <p className="text-sm font-bold text-white">Validación</p>
                    <p className="mt-0.5 text-sm leading-6 text-white/60">Revisamos el perfil y valoramos su adecuación al enfoque del club.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex-shrink-0 text-sm font-black text-electric">03</span>
                  <div>
                    <p className="text-sm font-bold text-white">Acceso</p>
                    <p className="mt-0.5 text-sm leading-6 text-white/60">Si existe encaje, contactaremos contigo para explicarte el funcionamiento y los siguientes pasos.</p>
                  </div>
                </div>
              </div>

              <p className="mt-8 text-xs leading-5 text-white/40">
                Enviar una solicitud no implica ningún compromiso de inversión ni garantiza el acceso al club.
              </p>
            </div>
          </div>

          {/* ── Right column · form ── */}
          <div className="bg-white p-6 sm:p-8 lg:p-10">
            {Object.keys(errors).length ? (
              <div role="alert" tabIndex={-1} className="mb-5 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <p className="font-bold text-charcoal/80">Revisa el formulario</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-charcoal/80">
                  {Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            ) : null}
            {result ? (
              <div ref={successRef} role="status" tabIndex={-1} className="mb-5 rounded-lg border border-frost bg-white p-4">
                <p className="font-bold text-ink">Solicitud recibida</p>
                <p className="mt-1 text-sm leading-6 text-charcoal/80">{result.message}</p>
              </div>
            ) : null}
            <form className="grid gap-[18px]" onSubmit={onSubmit} noValidate>
              <div className="hidden" aria-hidden="true">
                <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
              </div>

              {/* Row 1: Nombre + Email */}
              <div className="grid gap-[18px] sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Nombre *</span>
                  <input name="name" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="name" maxLength={100} disabled={submitting} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Email *</span>
                  <input name="email" type="email" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="email" maxLength={254} disabled={submitting} required />
                </label>
              </div>

              {/* Row 2: Teléfono + Perfil */}
              <div className="grid gap-[18px] sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Teléfono (opcional)</span>
                  <input name="phone" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" autoComplete="tel" maxLength={30} disabled={submitting} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-ink">Perfil *</span>
                  <select name="profile" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" disabled={submitting} required>
                    <option value="">Selecciona una opción</option>
                    {COINVEST_PROFILES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              {/* Full width: Experiencia */}
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-ink">Experiencia en inversión inmobiliaria *</span>
                <select name="experience" className="h-11 rounded-lg border border-frost bg-white px-3 text-ink focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" disabled={submitting} required>
                  <option value="">Selecciona una opción</option>
                  {COINVEST_EXPERIENCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              {/* Full width: Intereses */}
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-ink">Intereses</span>
                <textarea name="interests" rows={3} maxLength={1000} placeholder="Cuéntanos qué tipo de proyectos, ubicaciones u horizontes de inversión te interesan." className="min-h-[100px] rounded-lg border border-frost bg-white px-3 py-3 text-ink placeholder:text-charcoal/40 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20 disabled:opacity-60" disabled={submitting} />
              </label>

              {/* Consent + note */}
              <div>
                <label className="flex items-start gap-2.5 text-sm leading-6 text-charcoal/80">
                  <input name="consent" type="checkbox" className="mt-[0.35em] h-4 w-4 flex-shrink-0 accent-electric" disabled={submitting} required />
                  <span>Acepto que los datos facilitados se utilicen para evaluar mi solicitud de acceso y contactar conmigo en relación con el club.</span>
                </label>
                <p className="mt-1.5 pl-[26px] text-xs leading-5 text-charcoal/50">
                  No utilizaremos estos datos para comunicaciones comerciales ajenas a esta solicitud sin consentimiento adicional.
                </p>
              </div>

              {/* Button — full width inside form */}
              <button type="submit" disabled={submitting} className="h-12 w-full rounded-lg bg-electric px-6 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">
                {submitting ? 'Enviando…' : 'Solicitar acceso'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──

function Footer() {
  const footerLinks = [
    { label: 'Nosotros', href: '/#nosotros' },
    { label: 'Nuestra actividad', href: '/#actividad' },
    { label: 'Cómo trabajamos', href: '/#metodologia' },
    { label: 'Proyectos', href: '/#proyectos' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Contacto', href: '/#contacto' },
    { label: 'Coinvierte', href: '/#coinvierte' }
  ];

  return (
    <footer className="border-t border-frost bg-white" role="contentinfo">
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
          {/* Brand column */}
          <div>
            <p className="text-lg font-black uppercase tracking-[0.12em] text-ink">MILLENNIALS CONSTRUYEN</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-charcoal/60">Club privado de coinversión inmobiliaria.</p>
            <p className="mt-2 text-xs text-charcoal/40">Acceso sujeto a invitación o validación previa.</p>
          </div>

          {/* Navigation */}
          <nav aria-label="Navegación secundaria">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-charcoal/70">
              {footerLinks.map((item) => (
                <li key={item.href}>
                  <a className="hover:text-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom strip */}
        <div className="mt-8 border-t border-frost pt-5 text-xs leading-5 text-charcoal/40">
          <p>La información contenida en esta web tiene carácter informativo y no constituye una oferta pública de inversión. Toda inversión inmobiliaria implica riesgos y puede producir pérdidas.</p>
          <p className="mt-1">&copy; 2026 MILLENNIALS CONSTRUYEN</p>
        </div>
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
        <ProjectsSection />
        <FirmNarrative />
        <ProcessSection />
        <Methodology />
        <Faq />
        <ContactSection />
        <CoinvestSection />
      </main>
      <Footer />
    </div>
  );
}
