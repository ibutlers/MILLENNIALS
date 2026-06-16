import { Link } from 'react-router';

const onboardingRoutes = [
  '/onboarding',
  '/onboarding/perfil',
  '/onboarding/elegibilidad',
  '/onboarding/identidad',
  '/onboarding/fiscalidad',
  '/onboarding/riesgos',
  '/onboarding/completado'
];

const investorRoutes = [
  '/inversores',
  '/inversores/oportunidades',
  '/inversores/oportunidades/:slug',
  '/inversores/cartera',
  '/inversores/actualizaciones',
  '/inversores/documentos',
  '/inversores/cuenta',
  '/inversores/ayuda'
];

const verificationStates = [
  'Cuenta creada',
  'Email verificado',
  'Perfil incompleto',
  'KYC pendiente',
  'KYC en revisión',
  'Verificado',
  'Rechazado',
  'Requiere información adicional'
];

const opportunityFields = [
  'Nombre y localización',
  'Estrategia y estado',
  'Plazo y fecha de cierre',
  'Ticket mínimo',
  'Capital objetivo y capital comprometido',
  'Porcentaje financiado',
  'Rentabilidad objetivo estimada, anual o total, bruta o neta',
  'Nivel de riesgo visible junto al retorno'
];

const privateNavigation = ['Oportunidades', 'Cartera', 'Actualizaciones', 'Documentos', 'Centro de ayuda', 'Cuenta', 'Cerrar sesión'];

function PlannedHeader() {
  return (
    <header className="border-b border-border bg-carbon text-textLight">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
          <span className="grid h-10 w-10 place-items-center border border-mineral/70 text-lg font-black text-mineral">R</span>
          <span className="text-lg font-black uppercase tracking-[0.22em]">MILLENNIALS CONSTRUYEN</span>
        </Link>
        <Link to="/" className="border border-border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] hover:border-mineral hover:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover focus-visible:ring-offset-4 focus-visible:ring-offset-carbon">
          Volver a la home
        </Link>
      </div>
    </header>
  );
}

function RouteList({ title, routes }: { title: string; routes: string[] }) {
  return (
    <section className="border border-border bg-carbon p-5 sm:p-6">
      <h2 className="font-serif text-2xl text-textLight">{title}</h2>
      <ul className="mt-5 grid gap-2 text-sm text-muted">
        {routes.map((route) => (
          <li key={route} className="border border-border px-3 py-2 font-mono text-xs text-muted">
            {route}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuardrailCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-carbon/10 bg-ivory p-5 sm:p-6">
      <h2 className="font-serif text-2xl text-textDark">{title}</h2>
      <ul className="mt-5 grid gap-3 text-sm leading-6 text-textDark/75">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-2 w-2 shrink-0 bg-mineral" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlannedAccess({ variant }: { variant: 'access' | 'investors' }) {
  const isAccess = variant === 'access';

  return (
    <div className="min-h-screen bg-carbon text-textLight antialiased">
      <PlannedHeader />
      <main id="contenido" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="inline-flex border border-mineral/50 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-mineral">
          Próximamente · arquitectura futura
        </p>
        <h1 className="mt-6 max-w-5xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-7xl">
          {isAccess ? 'Acceso privado en preparación' : 'Área de inversores en preparación'}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">
          Esta pantalla es informativa: no permite iniciar sesión, registrar usuarios, verificar identidad, aportar capital ni confirmar inversiones. Su objetivo es dejar preparado el mapa de producto sin simular funcionalidades que todavía no tienen backend real.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <RouteList title="Rutas conceptuales de acceso y onboarding" routes={onboardingRoutes} />
          <RouteList title="Rutas conceptuales del área privada" routes={investorRoutes} />
        </div>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          {!isAccess ? (
            <GuardrailCard title="Navegación privada prevista" items={privateNavigation} />
          ) : null}
          <GuardrailCard
            title="Acceso y seguridad futura"
            items={[
              'Magic link, contraseña, segundo factor, recuperación segura y gestión de sesiones/dispositivos se diseñarán cuando exista backend real.',
              'No se crean formularios que aparenten enviar emails o autenticar en este hito.',
              'Los CTAs actuales llevan a esta explicación de producto, no a una autenticación simulada.'
            ]}
          />
          <GuardrailCard
            title="Estado de verificación compacto"
            items={verificationStates}
          />
          <GuardrailCard
            title="Catálogo privado de oportunidades"
            items={opportunityFields}
          />
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          <GuardrailCard
            title="Ficha futura de oportunidad"
            items={[
              'Resumen, tesis de inversión, activo, ubicación y mercado, estrategia, plan financiero y calendario.',
              'Riesgos, equipo y contrapartes, documentos, actualizaciones y preguntas frecuentes.',
              'Resumen superior con capital objetivo, capital comprometido, ticket mínimo, plazo, retorno objetivo, tipo de retorno, riesgo, estado y progreso.'
            ]}
          />
          <GuardrailCard
            title="Simulador futuro con escenarios"
            items={[
              'Escenario conservador, escenario base y escenario favorable; nunca una cifra única como promesa.',
              'Comisiones, impuestos no incluidos, supuestos de cálculo y capital potencialmente en riesgo visibles.',
              'No implementar todavía cálculos financieros reales.'
            ]}
          />
          <GuardrailCard
            title="Flujo de inversión futuro"
            items={[
              'Elegir importe, revisar elegibilidad y límites, revisar riesgos, consultar documentación y aceptar declaraciones.',
              'Ver desglose de comisiones, seleccionar método de aportación, firmar documentación y confirmar orden o compromiso.',
              'Debe ser imposible invertir si faltan verificación, documentación obligatoria, aceptación de riesgos, permisos o elegibilidad.'
            ]}
          />
        </section>

        {!isAccess ? (
          <section className="mt-10 border border-border bg-petroleum p-6 text-textLight sm:p-8">
            <h2 className="font-serif text-3xl">Cartera, documentos y actualizaciones</h2>
            <p className="mt-4 max-w-3xl leading-8 text-muted">
              La cartera futura mostrará capital comprometido, capital aportado, distribuciones recibidas, proyectos activos y finalizados, próximos hitos, documentos pendientes y actualizaciones recientes. No mostrará plusvalías no realizadas como beneficios seguros.
            </p>
            <p className="mt-4 max-w-3xl leading-8 text-muted">
              Cada proyecto podrá publicar hitos, obra, licencias, financiación, comercialización, incidencias, cambios de calendario, informes periódicos, contratos, anexos y documentación fiscal.
            </p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
