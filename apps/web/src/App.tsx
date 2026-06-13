const featuredProperties = [
  {
    title: 'Ático luminoso en Chamberí',
    location: 'Chamberí, Madrid',
    price: '1.240.000 €',
    operation: 'Comprar',
    type: 'Ático',
    details: '3 hab · 2 baños · 148 m²',
    accent: 'Terraza privada y orientación sur'
  },
  {
    title: 'Villa mediterránea con jardín',
    location: 'Nueva Andalucía, Marbella',
    price: '8.900 €/mes',
    operation: 'Alquilar',
    type: 'Villa',
    details: '5 hab · 4 baños · 420 m²',
    accent: 'Piscina, privacidad y seguridad 24 h'
  },
  {
    title: 'Piso reformado junto al Turia',
    location: 'El Pla del Remei, Valencia',
    price: '690.000 €',
    operation: 'Comprar',
    type: 'Piso',
    details: '2 hab · 2 baños · 112 m²',
    accent: 'Edificio clásico con eficiencia mejorada'
  }
];

const services = [
  {
    title: 'Valoración con datos reales',
    text: 'Comparamos mercado, demanda y atributos únicos para ayudarte a decidir con menos incertidumbre.'
  },
  {
    title: 'Selección curada',
    text: 'Priorizamos activos con ubicación, liquidez y calidad visual antes de incorporarlos al escaparate.'
  },
  {
    title: 'Acompañamiento experto',
    text: 'Un equipo operativo prepara visitas, documentación y próximos pasos sin fricción.'
  }
];

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-stone-50/90 backdrop-blur-xl">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="group inline-flex items-center gap-3 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-lg font-black text-white shadow-lg shadow-brand-primary/20">
            R
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-950">Realstate</span>
        </a>
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-sm font-semibold text-slate-700 md:flex">
          <a className="rounded-full hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#propiedades">
            Propiedades
          </a>
          <a className="rounded-full hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#servicios">
            Servicios
          </a>
          <a className="rounded-full hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#contacto">
            Contacto
          </a>
        </nav>
        <a
          href="#contacto"
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4 sm:px-5"
        >
          Hablar con un asesor
        </a>
      </div>
    </header>
  );
}

function SearchPanel() {
  return (
    <form
      aria-label="Buscar propiedades"
      role="search"
      className="mt-8 grid gap-4 rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 md:grid-cols-2"
    >
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Operación
        <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15">
          <option>Comprar</option>
          <option>Alquilar</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Ubicación
        <input
          className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15"
          placeholder="Madrid, Valencia, Marbella..."
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Tipo de propiedad
        <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15">
          <option>Cualquiera</option>
          <option>Piso</option>
          <option>Ático</option>
          <option>Villa</option>
          <option>Local comercial</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Precio máximo
        <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/15">
          <option>Sin límite</option>
          <option>500.000 €</option>
          <option>750.000 €</option>
          <option>1.000.000 €</option>
          <option>2.000.000 €</option>
        </select>
      </label>
      <button
        type="submit"
        className="min-h-12 rounded-2xl bg-brand-primary px-6 text-base font-bold text-white shadow-lg shadow-brand-primary/20 transition hover:-translate-y-0.5 hover:bg-[#0b3d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4 md:col-span-2"
      >
        Buscar propiedades
      </button>
    </form>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(227,179,65,0.25),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#f5efe3_42%,#e8f0f1_100%)]">
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-24 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 flex flex-col justify-center">
          <p className="mb-5 w-fit rounded-full border border-brand-accent/40 bg-white/70 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-brand-primary">
            Real estate curado para decidir mejor
          </p>
          <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Encuentra una propiedad con criterio, datos y acompañamiento experto.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
            Realstate combina selección inmobiliaria, lectura de mercado y una experiencia digital clara para comprar o alquilar activos con confianza.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#propiedades"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-base font-bold text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4"
            >
              Ver propiedades destacadas
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-base font-bold text-slate-900 transition hover:-translate-y-0.5 hover:border-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4"
            >
              Cómo trabajamos
            </a>
          </div>
          <SearchPanel />
        </div>
        <aside aria-label="Resumen del mercado" className="relative min-h-[420px] min-w-0 overflow-hidden rounded-[2.5rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/25">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(227,179,65,0.28),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(15,76,92,0.7),transparent_30%)]" aria-hidden="true" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-slate-300">Oportunidad destacada</p>
              <p className="mt-3 text-3xl font-black">Chamberí · 148 m²</p>
              <p className="mt-2 text-slate-300">Ático con terraza, luz natural y demanda premium contrastada.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white p-4 text-slate-950">
                <p className="text-3xl font-black">42</p>
                <p className="text-sm font-semibold text-slate-500">activos revisados</p>
              </div>
              <div className="rounded-3xl bg-brand-accent p-4 text-slate-950">
                <p className="text-3xl font-black">3.8%</p>
                <p className="text-sm font-semibold text-slate-700">rentabilidad estimada</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FeaturedProperties() {
  return (
    <section id="propiedades" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-primary">Propiedades destacadas</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Una primera selección para validar el escaparate público.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Datos mock realistas mientras se implementa el catálogo conectado a PostgreSQL en el siguiente hito.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {featuredProperties.map((property) => (
            <article
              key={property.title}
              aria-label={`Propiedad destacada: ${property.title}`}
              className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10"
            >
              <div className="relative h-56 bg-[linear-gradient(135deg,#0f4c5c,#172554)] p-5 text-white">
                <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,rgba(227,179,65,.55),transparent_24%),linear-gradient(120deg,transparent_45%,rgba(255,255,255,.16)_45%,rgba(255,255,255,.16)_58%,transparent_58%)]" aria-hidden="true" />
                <div className="relative flex h-full flex-col justify-between">
                  <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">{property.operation}</span>
                  <div>
                    <p className="text-sm text-slate-200">{property.location}</p>
                    <h3 className="mt-1 text-2xl font-black">{property.title}</h3>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-2xl font-black text-slate-950">{property.price}</p>
                <p className="mt-2 font-semibold text-brand-primary">{property.type} · {property.details}</p>
                <p className="mt-4 text-slate-600">{property.accent}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="servicios" className="bg-slate-950 py-16 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-accent">Servicios</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Más que un listado: contexto para decidir.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.title} className="rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur">
                <h3 className="text-xl font-black">{service.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactCta() {
  return (
    <section id="contacto" className="bg-stone-50 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-primary">Siguiente paso</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Prepara tu búsqueda con un asesor de Realstate.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Cuéntanos zona, presupuesto y objetivo. En esta fase el contacto es visual; la persistencia de leads llegará con el modelo de datos.
        </p>
        <a
          href="mailto:contacto@realstate.local"
          className="mt-8 inline-flex rounded-full bg-brand-primary px-7 py-3 text-base font-bold text-white shadow-xl shadow-brand-primary/20 transition hover:-translate-y-0.5 hover:bg-[#0b3d49] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4"
        >
          Solicitar orientación
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white" role="contentinfo">
      <div className="mx-auto grid max-w-7xl gap-8 border-t border-slate-200 px-4 py-10 text-sm text-slate-600 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <p className="text-lg font-black text-slate-950">Realstate</p>
          <p className="mt-2 max-w-xl">Fundación pública para una plataforma inmobiliaria profesional, preparada para catálogo, datos reales y captación de leads.</p>
        </div>
        <nav aria-label="Navegación secundaria" className="flex flex-wrap gap-4 font-semibold">
          <a className="hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#propiedades">Propiedades</a>
          <a className="hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#servicios">Servicios</a>
          <a className="hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4" href="#contacto">Contacto</a>
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 antialiased">
      <Header />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <FeaturedProperties />
        <Services />
        <ContactCta />
      </main>
      <Footer />
    </div>
  );
}
