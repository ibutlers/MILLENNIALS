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
- rutas informativas honestas para `/acceso` e `/inversores`, sin autenticación simulada;
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

## Arquitectura futura de la zona privada

La zona privada deberá estar separada de la landing pública y de los estados informativos actuales. Su evolución queda documentada para orientar diseño, rutas, modelo de permisos, pruebas y futuras APIs, sin implementar todavía autenticación real, KYC, cartera, pagos ni inversión real.

### 1. Acceso y onboarding

Rutas futuras orientativas:

- `/acceso`
- `/registro`
- `/verificar-email`
- `/onboarding`
- `/onboarding/perfil`
- `/onboarding/elegibilidad`
- `/onboarding/identidad`
- `/onboarding/fiscalidad`
- `/onboarding/riesgos`
- `/onboarding/completado`

El acceso podrá contemplar en el futuro:

- magic link;
- contraseña;
- segundo factor;
- recuperación segura;
- sesiones y dispositivos.

No crear formularios que aparenten enviar emails o autenticar si no existe backend real. En el Hito 1, `/acceso` es únicamente una pantalla informativa de arquitectura futura.

### 2. Área privada

Rutas futuras:

- `/inversores`
- `/inversores/oportunidades`
- `/inversores/oportunidades/:slug`
- `/inversores/cartera`
- `/inversores/actualizaciones`
- `/inversores/documentos`
- `/inversores/cuenta`
- `/inversores/ayuda`

Navegación prevista:

- Oportunidades;
- Cartera;
- Actualizaciones;
- Documentos;
- Centro de ayuda;
- Cuenta;
- Cerrar sesión.

En el Hito 1, `/inversores` y rutas relacionadas son pantallas informativas “próximamente”, no un dashboard funcional.

### 3. Estado de verificación

Estados previstos:

- cuenta creada;
- email verificado;
- perfil incompleto;
- KYC pendiente;
- KYC en revisión;
- verificado;
- rechazado;
- requiere información adicional.

La experiencia futura debe evitar banners grandes repetidos en todas las pantallas. La solución preferente será compacta:

- indicador de estado en header o panel;
- checklist de onboarding;
- aviso contextual cuando una acción exija verificación;
- CTA claro para completar el siguiente paso.

### 4. Catálogo privado de oportunidades

Cada tarjeta futura debe mostrar de forma ordenada:

- nombre;
- localización;
- estrategia;
- estado;
- plazo;
- ticket mínimo;
- capital objetivo;
- capital comprometido;
- porcentaje financiado;
- rentabilidad objetivo estimada;
- nivel o perfil de riesgo;
- fecha de cierre;
- imagen;
- CTA apropiado.

Estados posibles:

- Próximamente;
- Abierta;
- En financiación;
- Financiada;
- En ejecución;
- En comercialización;
- Cerrada;
- Cancelada.

No usar “rentabilidad” sin aclarar si es anual o total, si es TIR, ROI u otra métrica, si es bruta o neta, si incluye apalancamiento, y que es una estimación no garantizada.

### 5. Ficha futura de oportunidad

Secciones o pestañas previstas:

- Resumen;
- Tesis de inversión;
- Activo;
- Ubicación y mercado;
- Estrategia;
- Plan financiero;
- Calendario;
- Riesgos;
- Equipo y contrapartes;
- Documentos;
- Actualizaciones;
- Preguntas frecuentes.

Resumen superior:

- capital objetivo;
- capital comprometido;
- ticket mínimo;
- plazo;
- retorno objetivo;
- tipo de retorno;
- riesgo;
- estado;
- progreso.

### 6. Simulador futuro

El simulador futuro no debe mostrar una cifra única como si fuera segura. Debe contemplar:

- importe;
- escenario conservador;
- escenario base;
- escenario favorable;
- plazo;
- comisiones;
- impuestos no incluidos;
- capital potencialmente en riesgo;
- supuestos de cálculo;
- aviso de que no constituye garantía.

No implementar todavía cálculos financieros reales.

### 7. Flujo de inversión futuro

Pasos previstos:

1. Elegir importe.
2. Revisar elegibilidad y límites.
3. Revisar riesgos.
4. Consultar documentación.
5. Aceptar declaraciones.
6. Ver desglose de comisiones.
7. Seleccionar método de aportación.
8. Firmar documentación.
9. Confirmar orden o compromiso.
10. Recibir justificante y estado.

Debe ser imposible invertir si faltan:

- verificación;
- documentación obligatoria;
- aceptación de riesgos;
- permisos o elegibilidad.

### 8. Cartera futura

El panel de cartera debe mostrar:

- capital comprometido;
- capital aportado;
- valor o retorno solo cuando proceda;
- distribuciones recibidas;
- proyectos activos;
- proyectos finalizados;
- próximos hitos;
- documentos pendientes;
- actualizaciones recientes.

No mostrar plusvalías no realizadas como beneficios seguros.

### 9. Actualizaciones y documentos

Cada proyecto deberá poder ofrecer:

- hitos;
- obra;
- licencias;
- financiación;
- comercialización;
- incidencias;
- cambios de calendario;
- informes periódicos;
- contratos;
- anexos;
- documentación fiscal.

### 10. Diferenciación respecto a referencias

Realstate debe superar el patrón observado mediante:

- menos banners repetitivos;
- mejor uso del espacio móvil;
- métricas financieras inequívocas;
- riesgos visibles junto al retorno;
- escenarios, no promesas;
- mejor seguimiento posterior a la inversión;
- arquitectura documental;
- claridad sobre estado de la oportunidad;
- accesibilidad y navegación robustas.

## Aplicación estricta al Hito 1

No implementar todavía autenticación real, KYC, cartera, pagos ni inversión real. En este hito solo se permite:

- documentar la arquitectura futura;
- preparar CTAs y rutas conceptuales;
- crear pantallas informativas honestas o estados “próximamente”;
- mantener pruebas, accesibilidad, responsive, SEO, seguridad y despliegue.

No se permite:

- simular login, registro, magic links, KYC o sesiones;
- simular una inversión completada;
- mostrar cartera real o plusvalías no realizadas como beneficios seguros;
- añadir cifras financieras no verificadas;
- ampliar el alcance a backend, usuarios o base de datos.

## Alcance técnico actual

- API con `/health`, `/api/health` y `/api/ready`.
- API pública versionada de oportunidades: `GET /api/v1/opportunities` y `GET /api/v1/opportunities/:slug`.
- Modelo PostgreSQL inicial para oportunidades, media, highlights, riesgos e hitos.
- Migraciones SQL reproducibles con ledger `schema_migrations`, checksum y advisory lock.
- Seed demo idempotente con oportunidades ficticias propias, incluyendo fixtures privadas para validar exclusión pública.
- Representación financiera con céntimos enteros, basis points, ISO currency y tipos de retorno inequívocos.
- Landing pública conectada a la API con loading/error/empty y sin fallback falso cuando la API falla.
- Despliegue con Docker Compose, Caddy y PostgreSQL interno.
- Pruebas unitarias, documentación verificada, accesibilidad con axe y Playwright.
- Cabeceras de seguridad básicas en Caddy.

## Fuera de alcance del hito actual

Autenticación real, panel administrativo funcional, CRM, pagos, mapas, modelo de datos definitivo, migraciones, CRUD real, persistencia de leads, catálogo conectado a PostgreSQL y zona privada funcional.


## Hito 3 — catálogo público y ficha visual

El catálogo público vive en `/oportunidades` y consume exclusivamente `GET /api/v1/opportunities`. No usa mocks ni datos embebidos como fuente de verdad.

Capacidades visibles:

- introducción editorial con disclaimer demo;
- filtros por estado, ciudad, tipo de activo, estrategia y riesgo;
- ordenación por campos permitidos por API;
- paginación por `limit`/`offset`;
- filtros sincronizados con la URL para abrir, refrescar, compartir y volver desde una ficha;
- estados loading, error y vacío;
- tarjetas compactas con imagen, ubicación, activo, estrategia, estado, riesgo, ticket mínimo, capital objetivo, capital comprometido, progreso, plazo, retorno objetivo, tipo de retorno y cierre;
- CTA `Ver oportunidad` hacia la ficha visual.

La ficha pública vive en `/oportunidades/:slug` y consume `GET /api/v1/opportunities/:slug`. Incluye breadcrumb, imagen principal, resumen, métricas, progreso accesible, descripción, highlights, riesgos, hitos, media disponible y próximos pasos. Los CTAs permitidos son `Solicitar información` y `Solicitar acceso`; no hay `Invertir ahora`, simuladores ficticios, formularios transaccionales ni órdenes de inversión.

La clasificación de riesgo es informativa/demo y se muestra junto al retorno; no debe comunicarse solo por color ni presentarse como valoración regulatoria oficial.

## Hito 4 — captación segura de solicitudes

El producto incorpora flujos reales, no transaccionales, para `/solicitar-acceso`, `/contacto` y `/oportunidades/:slug/solicitar-informacion`. Los CTA públicos apuntan a estos flujos y ya no a páginas de preparación cuando la intención es solicitar acceso o información.

Reglas de producto:
- solicitar información no implica inversión, reserva, autenticación, KYC ni orden;
- el éxito solo se muestra tras respuesta `201` de la API;
- si `LEADS_ENABLED=false` o faltan datos legales reales, los formularios se muestran desactivados con un mensaje honesto;
- la política `/privacidad` es provisional, explica límites y no inventa sociedad, CIF, domicilio ni cumplimiento certificado.

Datos recogidos: nombre, apellidos, email normalizado, teléfono opcional, país opcional, rango aproximado opcional, mensaje opcional, origen/UTM y consentimientos separados. No se recogen documentos, patrimonio, DNI, datos bancarios ni KYC.
