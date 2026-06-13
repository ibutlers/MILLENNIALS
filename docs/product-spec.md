# Especificación de producto — Realstate

Realstate será una webapp inmobiliaria para presentar, consultar y gestionar oportunidades de real estate con una capa pública transparente y una futura zona privada de inversores.

## Usuarios

- Visitantes interesados en entender la tesis y oportunidades inmobiliarias resumidas.
- Inversores o coinversores que solicitan acceso a documentación privada.
- Operadores que gestionan inventario y seguimiento.
- Administradores del sistema.

## Alcance visible actual

La aplicación ofrece una fundación pública profesional para validar marca, narrativa y estructura de información antes de conectar datos reales:

- landing responsive y mobile-first;
- hero visual con imagen arquitectónica generada para Realstate;
- navegación pública desktop y menú móvil fullscreen accesible;
- selector ES/EN preparado;
- CTAs diferenciados para oportunidades demo, firma, solicitud de acceso y acceso inversores;
- narrativa corporativa antes de oportunidades;
- tesis de inversión, metodología, tecnología y análisis;
- indicadores de proceso sin cifras no verificadas;
- oportunidades públicas demo con rentabilidad objetivo estimada, plazo, ticket mínimo, capital objetivo, capital comprometido, estado, nivel de riesgo y progreso;
- FAQ;
- footer completo;
- página visual 404 para rutas desconocidas;
- SEO básico sin canonical definitiva mientras no exista dominio estable.

## Reglas de transparencia

Hasta disponer de datos verificables no se publican:

- capital gestionado;
- rentabilidad histórica;
- número de proyectos reales;
- volumen de propiedades analizadas;
- redes de colaboradores;
- oficinas o presencia internacional.

Toda cifra de oportunidad visible en este hito es demo y debe aparecer como dato ilustrativo. No se usa “retorno histórico” en datos mock.

## Alcance técnico actual

- API mínima con `/health` y `/api/health`.
- Despliegue con Docker Compose, Caddy y PostgreSQL interno.
- Pruebas unitarias, accesibilidad con axe y Playwright.
- Cabeceras de seguridad básicas en Caddy.

## Fuera de alcance del hito actual

Autenticación real, panel administrativo, CRM, pagos, mapas, modelo de datos definitivo, migraciones, CRUD real, persistencia de leads, catálogo conectado a PostgreSQL y zona privada funcional.
