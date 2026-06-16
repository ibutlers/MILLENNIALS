import { useEffect } from 'react';
import { setPageMetadata } from './metadata';

export function NosotrosPage() {
  useEffect(() => {
    setPageMetadata('Nosotros | MILLENNIALS CONSTRUYEN', 'MILLENNIALS CONSTRUYEN — Private Real Estate Investment Club. Selección rigurosa antes que volumen.');
  }, []);

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <section className="bg-white py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Nosotros</p>
              <h1 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
                Selección rigurosa antes que volumen.
              </h1>
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
      </main>
    </div>
  );
}
