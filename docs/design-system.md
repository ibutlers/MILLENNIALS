# Sistema de diseño — Realstate

Principios: sobrio, rápido, mobile-first, accesible y orientado a confianza.

## Personalidad visual

Realstate debe sentirse premium sin parecer una plantilla genérica ni un dashboard. La interfaz prioriza claridad, amplitud, contraste y señales visuales de confianza: tarjetas cuidadas, CTAs definidos, fondos cálidos y acentos dorados contenidos.

## Tokens iniciales

- Primario: `#0f4c5c`.
- Acento: `#e3b341`.
- Fondo principal: `#f8fafc`.
- Fondo cálido: `#fafaf9` / `stone-50`.
- Texto principal: `#0f172a`.
- Texto secundario: `#475569`.
- Superficie: `#ffffff`.
- Error: `#dc2626`.

## Componentes actuales

- `Header`: logotipo textual Realstate, navegación pública y CTA.
- `Hero`: propuesta de valor, CTAs y resumen visual de mercado.
- `SearchPanel`: buscador visual con labels asociados para operación, ubicación, tipo y precio máximo.
- `FeaturedProperties`: tarjetas de propiedad con datos mock realistas.
- `Services`: ventajas y servicios diferenciales.
- `ContactCta`: cierre comercial para solicitar orientación.
- `Footer`: navegación secundaria y contexto del producto.
- `NotFound`: página visual para rutas desconocidas.

## Accesibilidad

- HTML semántico con `header`, `nav`, `main`, `section`, `article` y `footer`.
- Skip link hacia el contenido principal.
- Foco visible en enlaces, botones y campos.
- Labels explícitos en controles del buscador.
- Contraste alto en texto y CTAs.
- Prueba Playwright con axe para bloquear violaciones críticas o serias en la home.

## Responsive

Diseño mobile-first validado en 375 px, 768 px y 1440 px. No debe existir scroll horizontal ni renderizado escalado como escritorio en móvil.

## Componentes previstos siguientes

Tarjetas de propiedad conectadas a API, filtros persistentes por query string, formularios de contacto con estados de carga/error/éxito, estados vacíos, skeletons y galería de detalle.
