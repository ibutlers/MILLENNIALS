# Sistema de diseño — MILLENNIALS CONSTRUYEN | CAPITAL

Principios: sobrio, rápido, mobile-first, accesible, transparente y orientado a confianza institucional.

## Personalidad visual

MILLENNIALS CONSTRUYEN | CAPITAL debe sentirse como una plataforma inmobiliaria profesional con criterio inversor, no como una plantilla de portal ni como una copia de referencias externas. La identidad se basa en:

- **navy charcoal** para la base institucional — neutro, atemporal, premium;
- **cream cálido** para lectura editorial;
- **amber gold** para acción, foco y estados interactivos principales — transmite prosperidad y exige jerarquía;
- **forest green** exclusivamente como color semántico: progreso de financiación, hitos completados, éxito;
- **tan editorial** solo como microdetalle secundario (disclaimers, separadores decorativos);
- **serif contemporánea** para titulares, mensajes institucionales y cifras demo;
- **sans serif legible** para navegación, labels, datos y cuerpo;
- UI precisa con bordes finos, separadores, tarjetas estructuradas y estados de foco claros.

## Tokens actuales — Palette v3 "Navy & Amber"

Variables CSS base:

```css
--color-bg-primary: #0C1524;
--color-bg-secondary: #141E30;
--color-surface-light: #F7F3EC;
--color-text-on-dark: #F0EBE0;
--color-text-on-light: #1A202C;
--color-text-muted: #8F9AA5;
--color-accent-primary: #C9A44B;
--color-accent-hover: #D9BA66;
--color-editorial-detail: #B8926A;
--color-success: #5B9A7C;
--color-border: #2A3344;
--color-error: #C75B5B;
--color-warning: #D4A24E;
```

Alias Tailwind:

- `navy`: `#0C1524` — base oscura principal.
- `navyLight`: `#141E30` — fondo secundario.
- `cream` / `ivory` / `stone`: `#F7F3EC` — superficie clara de lectura.
- `amber` / `mineral`: `#C9A44B` — acento principal, CTAs.
- `amberHover` / `mineralHover`: `#D9BA66` — hover de acento.
- `tan` / `bronze`: `#B8926A` — detalle editorial secundario.
- `forest`: `#5B9A7C` — verde semántico: progreso, éxito, hitos.
- `textLight`: `#F0EBE0` — texto sobre fondos oscuros.
- `textDark`: `#1A202C` — texto sobre fondos claros.
- `muted`: `#8F9AA5` — texto secundario.
- `border`: `#2A3344` — bordes y separadores.
- `danger`: `#C75B5B` — error.
- `warning`: `#D4A24E` — advertencia funcional.

Alias heredados preservados para compatibilidad: `carbon` → `navy`, `petroleum` → `navyLight`.

## Reglas de aplicación cromática

- Fondo general oscuro en navy charcoal, no negro puro.
- Hero con degradado navy y fotografía oscurecida.
- **CTAs principales en amber gold** — nunca verde (el verde es semántico).
- Hover y focus en amber más claro.
- Textos principales en cream cálido sobre fondos oscuros.
- Bordes y separadores en navy sutil.
- **Tan solo como detalle editorial** muy secundario: líneas, etiquetas no críticas, disclaimers y microdetalles; nunca como color dominante ni como único indicador funcional.
- Secciones claras en cream cálido, evitando blanco puro.
- Tarjetas con contraste suave entre `navy` y `navyLight`.
- **Forest green reservado exclusivamente para**: barras de progreso de financiación, indicadores de hitos completados, estados de éxito. Nunca para CTAs ni navegación.
- Riesgo, advertencia y error deben usar colores semánticos accesibles, no color de marca.

## Contraste y accesibilidad

Contrastes base comprobados:

- `#F0EBE0` sobre `#0C1524`: AA/AAA para texto normal.
- `#8F9AA5` sobre `#0C1524`: AA para texto normal.
- `#C9A44B` sobre `#0C1524`: AA para texto grande.
- `#1A202C` sobre `#C9A44B`: AA para CTAs.
- `#1A202C` sobre `#F7F3EC`: AA/AAA para texto normal.
- `#5B9A7C` sobre `#141E30`: AA para barras de progreso.

`#B8926A` no debe usarse como texto pequeño sobre oscuro cuando sea información esencial: queda reservado a microdetalles editoriales o elementos con soporte semántico adicional.

## Componentes actuales

- `Header`: logotipo textual MILLENNIALS CONSTRUYEN | CAPITAL, navegación desktop, selector ES/EN preparado, acceso inversores y menú móvil.
- Menú móvil fullscreen: dialog accesible, cierre visible, Escape, restauración de foco y bloqueo de scroll del fondo.
- `Hero`: imagen arquitectónica generada específicamente para MILLENNIALS CONSTRUYEN | CAPITAL en WebP responsive con overlay navy oscuro, titular editorial y dos CTAs jerarquizados.
- `FirmNarrative`: narrativa corporativa antes de oportunidades.
- `ProcessSection`: indicadores de proceso sin cifras no verificadas.
- `Methodology`: tesis, metodología, tecnología y análisis.
- `Opportunities`: tarjetas públicas con inversión pública del proyecto, rentabilidad objetivo estimada, plazo, ticket mínimo, estado público y progreso de inversión. El CAPEX total y la financiación bancaria quedan para la ficha.
- `PlannedAccess`: pantallas informativas honestas para `/acceso` e `/inversores`, sin formularios ni autenticación simulada.
- `FAQ`: acordeones semánticos con `details/summary`.
- `AccessCta`: acceso privado futuro y solicitud de acceso.
- `Footer`: contexto, navegación secundaria y aviso de datos demo.
- `NotFound`: página visual para rutas desconocidas.

## Reglas de contenido

Hasta disponer de datos verificables no se publican cifras de capital gestionado, rentabilidad histórica, número de proyectos reales, propiedades analizadas, redes de colaboradores, oficinas ni presencia internacional. Las oportunidades y cifras de este hito son demo y se etiquetan como datos ilustrativos.

No usar «retorno histórico» en datos mock. Las tarjetas deben distinguir como mínimo:

- rentabilidad objetivo estimada;
- plazo estimado;
- ticket mínimo;
- inversión pública;
- CAPEX total y financiación bancaria solo en ficha;
- estado del proyecto;
- nivel de riesgo;
- naturaleza ilustrativa de los datos.

## Fotografía y assets

Las imágenes actuales son composiciones arquitectónicas generadas específicamente para MILLENNIALS CONSTRUYEN | CAPITAL, exportadas como WebP y servidas con dimensiones explícitas. El hero usa `srcset` y `sizes`; las imágenes fuera del hero usan `loading="lazy"`.

No se deben reutilizar imágenes, logotipos, iconos ni activos de competidores.

## Responsive

Diseño mobile-first validado en 375 px, 768 px y 1440 px. No debe existir scroll horizontal ni renderizado escalado como escritorio en móvil. Los titulares usan tamaños grandes pero controlados en móvil para evitar saltos incómodos.

## Componentes previstos siguientes

Detalle de oportunidad, filtros persistentes por query string, formularios con estados de carga/error/éxito conectados a backend real, modelo de datos, documentación privada y zona de inversores funcional.


## Hito 3 — catálogo y ficha

Componentes públicos añadidos:

- `OpportunitiesCatalogPage`: página `/oportunidades` con fondo navy, filtros en panel técnico, tarjetas cream compactas y paginación.
- `OpportunityCard`: tarjeta compacta con imagen local lazy, badges de estado/riesgo, métricas densas y progreso accesible.
- `OpportunityDetailPage`: ficha visual `/oportunidades/:slug` con hero oscuro, imagen principal eager/fetch priority, cuerpo editorial cream y aside sticky de métricas.
- `FundingProgress`, `Metric`, `StatusBadge`, `RiskBadge`: primitives reutilizables para mantener riesgo visible junto a retorno y evitar depender solo del color.

Reglas visuales específicas:

- Catálogo: base navy, panel de filtros tecnológico, cards cream para lectura y escaneo móvil.
- Ficha: cabecera institucional oscura, contenido editorial claro, CTA amber y riesgo con soporte textual.
- Imágenes fuera del hero/ficha principal usan `loading="lazy"`; la imagen principal de ficha usa dimensiones explícitas y prioridad alta.
- No usar patrones visuales de portal inmobiliario masivo ni copiar composición de competidores.

## Hito 4 — formularios públicos

Los formularios mantienen navy, cream, amber y tan secundario. Reglas de UX:
- labels visibles y ayuda contextual;
- resumen accesible de errores con foco gestionado;
- CTA amber no transaccional;
- estado desactivado honesto cuando falta configuración legal;
- referencia pública visible solo tras éxito real;
- honeypot invisible fuera del flujo de teclado;
- sin localStorage para datos del formulario.

Las páginas `/solicitar-acceso`, `/contacto`, `/oportunidades/:slug/solicitar-informacion` y `/privacidad` deben mantener lectura móvil excelente y axe sin errores críticos o serios.
