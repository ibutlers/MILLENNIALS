# Sistema de diseño — Realstate

Principios: sobrio, rápido, mobile-first, accesible, transparente y orientado a confianza institucional.

## Personalidad visual

Realstate debe sentirse como una plataforma inmobiliaria profesional con criterio inversor, no como una plantilla de portal ni como una copia de referencias externas. La identidad actual combina:

- carbón profundo para base institucional;
- marfil cálido para lectura editorial;
- verde mineral para confianza y tecnología;
- cobre oscuro como acento puntual;
- serif contemporánea para titulares, mensajes institucionales y cifras demo;
- sans serif legible para navegación, labels, datos y cuerpo;
- UI precisa con bordes finos, separadores, tarjetas estructuradas y estados de foco claros.

## Tokens actuales

- Carbón: `#070908`.
- Marfil: `#f4efe6`.
- Piedra cálida: `#e7e1d6`.
- Verde mineral: `#143f3a`.
- Cobre oscuro: `#b66a43`.
- Texto principal en claro: `#f4efe6`.
- Texto principal en oscuro: `#070908`.
- Error: `#dc2626`.

## Componentes actuales

- `Header`: logotipo textual Realstate, navegación desktop, selector ES/EN preparado, acceso inversores y menú móvil.
- Menú móvil fullscreen: dialog accesible, cierre visible, Escape, restauración de foco y bloqueo de scroll del fondo.
- `Hero`: imagen arquitectónica generada específicamente para Realstate en WebP responsive con overlay oscuro, titular editorial y dos CTAs jerarquizados.
- `FirmNarrative`: narrativa corporativa antes de oportunidades.
- `ProcessSection`: indicadores de proceso sin cifras no verificadas.
- `Methodology`: tesis, metodología, tecnología y análisis.
- `Opportunities`: tarjetas públicas demo con rentabilidad objetivo estimada, plazo, ticket mínimo, capital objetivo, capital comprometido, estado, nivel de riesgo y progreso demo.
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

Las imágenes actuales son composiciones arquitectónicas generadas específicamente para Realstate, exportadas como WebP y servidas con dimensiones explícitas. El hero usa `srcset` y `sizes`; las imágenes fuera del hero usan `loading="lazy"`.

No se deben reutilizar imágenes, logotipos, iconos ni activos de competidores.

## Accesibilidad

- HTML semántico con `header`, `nav`, `main`, `section`, `article`, `details`, `summary` y `footer`.
- Skip link hacia el contenido principal.
- Foco visible en enlaces, botones, controles y elementos del menú.
- Menú móvil con foco atrapado, cierre con Escape, restauración del foco y bloqueo de scroll.
- Contraste verificado con axe sin violaciones críticas o serias en la home.

## Responsive

Diseño mobile-first validado en 375 px, 768 px y 1440 px. No debe existir scroll horizontal ni renderizado escalado como escritorio en móvil. Los titulares usan tamaños grandes pero controlados en móvil para evitar saltos incómodos.

## Componentes previstos siguientes

Detalle de oportunidad, filtros persistentes por query string, formularios con estados de carga/error/éxito, conexión a API, modelo de datos, documentación privada y zona de inversores.
