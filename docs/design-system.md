# Sistema de diseño — MILLENNIALS CONSTRUYEN | CAPITAL

Principios: sobrio, rápido, mobile-first, accesible, transparente y orientado a confianza institucional.

## Personalidad visual

MILLENNIALS CONSTRUYEN | CAPITAL debe sentirse como una plataforma inmobiliaria profesional con criterio inversor, no como una plantilla de portal ni como una copia de referencias externas. La identidad actual se aleja del negro/cobre dominante y se basa en:

- azul petróleo profundo para la base institucional;
- marfil cálido para lectura editorial;
- verde mineral para acción, foco y estados interactivos principales;
- azul grisáceo para bordes y separadores;
- bronce editorial solo como microdetalle secundario;
- serif contemporánea para titulares, mensajes institucionales y cifras demo;
- sans serif legible para navegación, labels, datos y cuerpo;
- UI precisa con bordes finos, separadores, tarjetas estructuradas y estados de foco claros.

## Tokens actuales

Variables CSS base:

```css
--color-bg-primary: #08191C;
--color-bg-secondary: #10282C;
--color-surface-light: #F3EFE6;
--color-text-on-dark: #F7F4EC;
--color-text-on-light: #172126;
--color-text-muted: #8FA1A4;
--color-accent-primary: #7FA88C;
--color-accent-hover: #95B99F;
--color-editorial-detail: #9A765A;
--color-border: #294247;
--color-error: #B85C5C;
--color-warning: #C69A4B;
```

Alias Tailwind:

- `carbon`: `#08191C`.
- `petroleum`: `#10282C`.
- `ivory` / `stone`: `#F3EFE6`.
- `textLight`: `#F7F4EC`.
- `textDark`: `#172126`.
- `muted`: `#8FA1A4`.
- `mineral`: `#7FA88C`.
- `mineralHover`: `#95B99F`.
- `bronze`: `#9A765A`.
- `border`: `#294247`.
- `danger`: `#B85C5C`.
- `warning`: `#C69A4B`.

## Reglas de aplicación cromática

- Fondo general oscuro en azul petróleo, no negro puro.
- Hero con degradado azul petróleo y fotografía oscurecida.
- CTAs principales en verde mineral.
- Hover y focus en verde mineral más claro.
- Textos principales en marfil cálido sobre fondos oscuros.
- Bordes y separadores en azul grisáceo.
- Bronce solo como detalle editorial muy secundario: líneas, etiquetas no críticas y microdetalles; nunca como color dominante ni como único indicador funcional.
- Secciones claras en marfil cálido, evitando blanco puro.
- Tarjetas con contraste suave entre `#08191C` y `#10282C`.
- Riesgo, advertencia y error deben usar colores semánticos accesibles, no color de marca.

## Contraste y accesibilidad

Contrastes base comprobados:

- `#F7F4EC` sobre `#08191C`: AA/AAA para texto normal.
- `#8FA1A4` sobre `#08191C`: AA para texto normal.
- `#7FA88C` sobre `#08191C`: AA para texto normal.
- `#172126` sobre `#7FA88C`: AA para CTAs.
- `#172126` sobre `#F3EFE6`: AA/AAA para texto normal.

`#9A765A` no debe usarse como texto pequeño sobre oscuro cuando sea información esencial: queda reservado a microdetalles editoriales o elementos con soporte semántico adicional.

## Componentes actuales

- `Header`: logotipo textual MILLENNIALS CONSTRUYEN | CAPITAL, navegación desktop, selector ES/EN preparado, acceso inversores y menú móvil.
- Menú móvil fullscreen: dialog accesible, cierre visible, Escape, restauración de foco y bloqueo de scroll del fondo.
- `Hero`: imagen arquitectónica generada específicamente para MILLENNIALS CONSTRUYEN | CAPITAL en WebP responsive con overlay azul petróleo oscuro, titular editorial y dos CTAs jerarquizados.
- `FirmNarrative`: narrativa corporativa antes de oportunidades.
- `ProcessSection`: indicadores de proceso sin cifras no verificadas.
- `Methodology`: tesis, metodología, tecnología y análisis.
- `Opportunities`: tarjetas públicas demo con rentabilidad objetivo estimada, plazo, ticket mínimo, capital objetivo, capital comprometido, estado, nivel de riesgo y progreso demo.
- `PlannedAccess`: pantallas informativas honestas para `/acceso` e `/inversores`, sin formularios ni autenticación simulada.
- `FAQ`: acordeones semánticos con `details/summary`.
- `AccessCta`: acceso privado futuro y solicitud de acceso.
- `Footer`: contexto, navegación secundaria y aviso de datos demo.
- `NotFound`: página visual para rutas desconocidas.

## Reglas de contenido

Hasta disponer de datos verificables no se publican cifras de capital gestionado, rentabilidad histórica, número de proyectos reales, propiedades analizadas, redes de colaboradores, oficinas ni presencia internacional. Las oportunidades y cifras de este hito son demo y se etiquetan como datos ilustrativos.

No usar “retorno histórico” en datos mock. Las tarjetas deben distinguir como mínimo:

- rentabilidad objetivo estimada;
- plazo estimado;
- ticket mínimo;
- capital objetivo;
- capital comprometido;
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

- `OpportunitiesCatalogPage`: página `/oportunidades` con fondo azul petróleo, filtros en panel técnico, tarjetas marfil compactas y paginación.
- `OpportunityCard`: tarjeta compacta con imagen local lazy, badges de estado/riesgo, métricas densas y progreso accesible.
- `OpportunityDetailPage`: ficha visual `/oportunidades/:slug` con hero oscuro, imagen principal eager/fetch priority, cuerpo editorial marfil y aside sticky de métricas.
- `FundingProgress`, `Metric`, `StatusBadge`, `RiskBadge`: primitives reutilizables para mantener riesgo visible junto a retorno y evitar depender solo del color.

Reglas visuales específicas:

- Catálogo: base azul petróleo, panel de filtros tecnológico, cards marfil para lectura y escaneo móvil.
- Ficha: cabecera institucional oscura, contenido editorial claro, CTA mineral y riesgo con soporte textual.
- Imágenes fuera del hero/ficha principal usan `loading="lazy"`; la imagen principal de ficha usa dimensiones explícitas y prioridad alta.
- No usar patrones visuales de portal inmobiliario masivo ni copiar composición de competidores.

## Hito 4 — formularios públicos

Los formularios mantienen azul petróleo, marfil, verde mineral y bronce secundario. Reglas de UX:
- labels visibles y ayuda contextual;
- resumen accesible de errores con foco gestionado;
- CTA mineral no transaccional;
- estado desactivado honesto cuando falta configuración legal;
- referencia pública visible solo tras éxito real;
- honeypot invisible fuera del flujo de teclado;
- sin localStorage para datos del formulario.

Las páginas `/solicitar-acceso`, `/contacto`, `/oportunidades/:slug/solicitar-informacion` y `/privacidad` deben mantener lectura móvil excelente y axe sin errores críticos o serios.
