# Arquitectura — Realstate

Monorepo pnpm:

- `apps/web`: React + Vite + TypeScript.
- `apps/api`: Fastify + TypeScript.
- `docs`: documentación de producto, arquitectura, despliegue y diseño.

## Servicios Docker Compose

- `frontend`: assets estáticos Vite servidos por Nginx.
- `api`: Fastify interno en `3001`.
- `postgres`: PostgreSQL 16 interno, sin puerto expuesto al host.
- `proxy`: Caddy en `${REALSTATE_HTTP_PORT:-8088}`.

Producción usa proyecto Compose fijo `current`; el volumen persistente de PostgreSQL es `current_postgres-data`.

## Persistencia Hito 2

Decisión: SQL explícito + `pg`.

Motivos:

- compatible con Node.js, TypeScript, Fastify, PostgreSQL y pnpm;
- migraciones reproducibles y versionadas en Git;
- sin sincronización automática destructiva;
- sin runtime ORM pesado ni generación obligatoria;
- consultas parameterizadas y tipadas en la capa repositorio;
- contratos públicos validados con Zod.

No se usa `schema sync` ni introspección destructiva en producción.

## Modelo de datos público

### `opportunities`

Entidad principal del catálogo público/futuro privado:

- `id` UUID;
- `slug` único;
- título, descripciones, ciudad, país, distrito;
- tipo de activo y estrategia;
- `status` enum;
- `visibility` enum;
- `currency` ISO;
- importes en céntimos enteros;
- plazo en meses;
- tipo de retorno objetivo;
- retorno en basis points;
- nivel de riesgo;
- fechas de cierre/publicación/creación/actualización.

### Tablas relacionadas

- `opportunity_media`;
- `opportunity_highlights`;
- `opportunity_risks`;
- `opportunity_milestones`.

Todas referencian `opportunities(id)` con `ON DELETE CASCADE`, preparadas para una futura gestión administrativa.

## Enums y reglas

Estados:

- `coming_soon`, `open`, `funding`, `funded`, `in_execution`, `commercializing`, `closed`, `cancelled`.

Visibilidad:

- `public`, `private`, `unlisted`, `draft`.

Riesgo:

- `low`, `medium`, `high`, `very_high`.

El riesgo se presenta como perfil informativo no regulatorio; no es una valoración oficial.

Tipos de retorno objetivo:

- `target_annual_return`;
- `target_total_return`;
- `target_irr`;
- `target_roi`.

## Representación financiera

- Dinero: enteros en céntimos (`*_amount_cents`).
- Porcentajes: basis points (`target_return_bps`).
- Moneda: ISO 4217 (`EUR`, etc.).
- Progreso: calculado como `committed_amount_cents / target_amount_cents`, acotado a `0..100`.
- Fechas: ISO.
- Valores no publicados: `null` o etiquetas honestas en frontend.

No se usan `float` para dinero ni porcentajes.

## API pública

Endpoints versionados:

- `GET /api/v1/opportunities`
- `GET /api/v1/opportunities/:slug`
- `GET /api/v1/opportunity-filters`

Filtros permitidos en listado:

- `status`;
- `city`;
- `assetType`;
- `strategy`;
- `riskLevel`;
- `limit`;
- `offset`;
- `sort` (`publishedAt`, `closingDate`, `fundingProgress`, `minimumInvestment`, `targetAmount`);
- `direction` (`asc`, `desc`).

Las queries usan parámetros PostgreSQL y una lista cerrada de campos de ordenación. No se aceptan filtros arbitrarios.

## Contratos y seguridad de respuesta

Zod valida query params, path params y respuestas.

El listado devuelve:

- resumen público;
- paginación;
- progreso calculado;
- imagen principal;
- disclaimer de objetivos no garantizados;
- metadatos de ordenación permitida.

La ficha devuelve:

- resumen;
- descripción;
- métricas;
- highlights;
- riesgos;
- hitos;
- media;
- fechas;
- disclaimer.

No devuelve documentos privados, inversores, KYC, pagos, datos internos ni campos administrativos sensibles.

## Health y observabilidad

- `/health`: liveness de proceso, no depende de PostgreSQL.
- `/api/health`: health API con dependencia PostgreSQL.
- `/api/ready`: readiness con PostgreSQL.

Errores públicos siguen formato seguro:

```json
{ "error": { "id": "err_...", "code": "invalid_request", "message": "..." } }
```

Los logs incluyen identificador de error y contexto seguro, sin credenciales ni SQL sensible.


## Frontend Hito 3

Rutas públicas visuales:

- `/oportunidades`: catálogo público conectado a PostgreSQL vía API.
- `/oportunidades/:slug`: ficha pública visual conectada a API.

La navegación se gestiona con React Router y las rutas funcionan al navegar, abrir directamente y refrescar gracias al fallback SPA del frontend. TanStack Query gestiona cache, cancelación mediante `AbortSignal`, conservación de datos durante paginación y evita requests duplicadas.

El cliente `apps/web/src/opportunities/api.ts` valida respuestas con Zod antes de renderizar. Si la API falla, el frontend muestra estados honestos y no inventa oportunidades.

La URL del catálogo es la fuente del estado de filtros/orden/paginación. Al abrir una ficha desde el catálogo se preserva el query string para volver con filtros restaurados.

## Trazabilidad de release

Cada nueva release creada por `scripts/deploy.sh` incluye un archivo `REVISION` generado después de validar que `main` está limpia y coincide con `origin/main`. El archivo contiene únicamente el SHA completo desplegado.

## Hito 4 — arquitectura de leads

La API añade `POST /api/v1/leads` y `GET /api/v1/lead-settings`. No existe ningún `GET` público de leads. La persistencia se implementa con SQL explícito y `pg`, manteniendo la misma política de migraciones reproducibles y no destructivas.

`0002_create_leads.sql` crea:
- enum `lead_kind`: `access_request`, `opportunity_inquiry`, `general_contact`;
- enum `lead_status`: `new`, `in_review`, `contacted`, `qualified`, `closed`, `rejected`;
- tabla `leads` con `public_reference` único, FK nullable a `opportunities`, email normalizado, consentimientos separados y checks de longitud.

La captación queda detrás de `LEADS_ENABLED` y además requiere `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL` y `PRIVACY_POLICY_VERSION`. El rate limit en memoria por origen reduce abuso sin añadir CAPTCHA externo. Los logs del endpoint solo incluyen referencia pública y tipo; no nombres, emails, teléfonos ni mensajes.

El frontend usa code-splitting por ruta mediante `React.lazy` para catálogo, ficha, formularios, páginas informativas y rutas de acceso futuro.

## Hito 5 — identidad y autenticación

### Modelo de datos de autenticación

Migración `0003_create_auth.sql` (aditiva, no destructiva):

- `users` — cuentas de usuario con email único normalizado, contraseña con hash Argon2id, estado y rol.
- `user_roles` — roles asignados: `investor`, `operator`, `admin`.
- `sessions` — sesiones opacas con hash SHA-256 almacenado en PostgreSQL. Cookies HttpOnly, SameSite=Lax, Secure.
- `email_verification_tokens` — tokens de verificación de email con expiración.
- `password_reset_tokens` — tokens de recuperación de contraseña con expiración.
- `audit_events` — eventos de auditoría para acciones sensibles.

### Contraseñas y sesiones

- Contraseñas: Argon2id con 64 MiB de memoria, timeCost=3, parallelism=1.
- Sesiones: token opaco generado en servidor, hash SHA-256 almacenado en PostgreSQL. Cookie `session_id` con flags HttpOnly, SameSite=Lax y Secure.
- Rate limiting por endpoint para prevenir abuso.
- Anti-enumeración de cuentas: mensajes genéricos en login, registro y recuperación.

### Feature flags

```dotenv
AUTH_ENABLED=false
REGISTRATION_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
```

### Bootstrap administrativo

CLI administrativo para gestionar usuarios sin pasar por registro público:

```bash
pnpm users:create-admin
pnpm users:list
pnpm users:disable -- --email <email>
pnpm users:revoke-sessions -- --email <email>
```

### Limitaciones del hito

- No autenticación OAuth, social login ni MFA en este hito.
- Auth desactivada en producción hasta disponer de HTTPS y dominio real.
