import { useEffect } from 'react';
import { setPageMetadata } from './metadata';

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

export function ActividadPage() {
  useEffect(() => {
    setPageMetadata('Nuestra actividad | MILLENNIALS CONSTRUYEN', 'Cómo trabajamos en MILLENNIALS CONSTRUYEN: arquitectura tecnológica, tesis de inversión y metodología.');
  }, []);

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <section className="bg-lavender py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-electric">Nuestra actividad</p>
                <h1 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-6xl">
                  Menos ruido, más trazabilidad.
                </h1>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-frost bg-frost sm:grid-cols-2">
                {['Análisis proyecto a proyecto', 'Documentación estructurada', 'Seguimiento periódico', 'Inversión con horizonte definido', 'Revisión técnica, comercial y financiera', 'Actualización de avance'].map((item) => (
                  <div key={item} className="bg-white p-6">
                    <span className="mb-5 block h-8 w-8 bg-electric/10" aria-hidden="true" />
                    <p className="text-xl font-semibold text-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-24">
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
      </main>
    </div>
  );
}
