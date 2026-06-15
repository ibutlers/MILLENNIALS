# MILLENNIALS CONSTRUYEN | CAPITAL

Webapp inmobiliaria para presentar oportunidades de real estate con una base pública institucional, API pública de oportunidades y preparación para una futura zona privada de inversores.

## Estado actual

La aplicación desplegada incluye:

- **Baseline definitivo (Hito 11):** migración única inmutable, runner con advisory lock y checksum SHA-256
- **PostgreSQL:** 28 tablas, 19 enums, 31 FK, modelo de datos completo (oportunidades, identidad, inversor, leads, documentos, inversión, cartera, operación)
- **API pública:** `GET /api/v1/opportunities` con filtros, paginación, ordenación; `GET /api/v1/opportunities/:slug`
- **Frontend:** landing institucional, catálogo público (4 oportunidades demo), fichas con highlights/riesgos/hitos/media
- **Estados honestos:** loading, error, vacío — sin datos mock cuando la API falla
- **Auth/Admin desactivados** en producción (`AUTH_ENABLED=false`, `ADMIN_ENABLED=false`)
- **Seed idempotente:** 5 oportunidades demo (4 públicas + 1 privada)
- **Calidad:** 88 tests (69 API + 19 web), lint, typecheck, build, audit
- **Despliegue:** Docker Compose, Caddy proxy, nginx para assets, backup automático
- cabeceras de seguridad configuradas en Caddy.

Las oportunidades y cifras visibles son demo y están marcadas como datos ilustrativos. No se publica capital gestionado, rentabilidad histórica, número de proyectos reales, oficinas ni presencia internacional hasta tener datos verificables.

No están implementados todavía: KYC, pagos, cartera, inversión real, panel administrativo funcional ni documentos privados.

## Stack

React + Vite + TypeScript, React Router, Tailwind CSS, Zod, Node.js + Fastify, PostgreSQL, `pg`, Vitest, Testing Library, Playwright, axe, Docker Compose + Caddy.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --audit-level=low
bash -n scripts/*.sh
git diff --check
```

## Base de datos

```bash
pnpm --filter @realstate/api db:migrate
pnpm --filter @realstate/api db:seed
./scripts/test-database.sh
```

Representación financiera:

- importes en céntimos enteros;
- porcentajes en basis points;
- moneda ISO;
- tipos de retorno explícitos: anual objetivo, total objetivo, TIR objetivo y ROI objetivo.

## API pública

```bash
curl http://127.0.0.1:8088/api/v1/opportunities
curl http://127.0.0.1:8088/api/v1/opportunities/eixample-rehabilitacion-luminosa
```

Filtros permitidos:

- `status`
- `city`
- `assetType`
- `strategy`
- `riskLevel`
- `limit`
- `offset`
- `sort`
- `direction`

## Producción

El único comando autorizado de producción es:

```bash
./scripts/deploy.sh
```

Reglas de seguridad operativa:

- no mostrar secretos;
- no ejecutar `docker compose down -v`;
- preservar `current_postgres-data`;
- mantener `COMPOSE_PROJECT_NAME=current`;
- usar rollback con `./scripts/rollback.sh` si procede.

Ver `AGENTS.md` y `docs/` antes de modificar el proyecto.


## Catálogo y ficha pública

Rutas Hito 3:

```text
/oportunidades
/oportunidades/:slug
```

El catálogo consume `GET /api/v1/opportunities` con filtros `status`, `city`, `assetType`, `strategy`, `riskLevel`, `sort`, `direction`, `limit` y `offset`. La ficha consume `GET /api/v1/opportunities/:slug`. Ambas rutas validan contratos con Zod y muestran estados loading/error/empty sin inventar datos si la API falla.

Los CTAs públicos son `Ver oportunidad`, `Solicitar información` y `Solicitar acceso`. No hay autenticación, KYC, pagos, cartera, administración ni inversión real.

Después de deploy puede verificarse la trazabilidad con:

```bash
cat /srv/deployments/realstate/current/REVISION
git -C /srv/workspaces/realstate rev-parse HEAD
```

## Leads y solicitudes públicas

Hito 4 añade `POST /api/v1/leads` para tres tipos: `access_request`, `opportunity_inquiry` y `general_contact`. No hay endpoints públicos de listado de leads. La respuesta de éxito devuelve solo referencia pública, tipo, estado `new`, fecha y mensaje genérico.

Feature flags y privacidad:
```dotenv
LEADS_ENABLED=false
PRIVACY_CONTROLLER_NAME=
PRIVACY_CONTACT_EMAIL=
PRIVACY_POLICY_VERSION=2026-06-14
LEADS_RATE_LIMIT_MAX=5
LEADS_RATE_LIMIT_WINDOW_MS=900000
```

Mientras falten datos legales reales, producción debe permanecer con captación desactivada. Gestión local:
```bash
pnpm leads:summary
pnpm leads:list -- --status new --limit 20
pnpm leads:update -- --reference <ref> --status contacted
```
Usa `--show-pii` solo cuando sea necesario operacionalmente.

## Autenticación y sesiones (Hito 5)

- Identidad de inversores con registro y verificación de email.
- Sesiones seguras con hash SHA-256 en PostgreSQL, cookies HttpOnly/SameSite/Secure.
- Contraseñas con Argon2id (64 MiB, timeCost=3, parallelism=1).
- Área privada bajo `/inversores/*` con dashboard, oportunidades, cuenta y seguridad.
- Roles: `investor`, `operator`, `admin`.
- Recuperación de contraseña con token enviado por email.
- Bootstrap administrativo vía CLI (`pnpm users:create-admin`, `users:list`, `users:disable`, `users:revoke-sessions`).
- Auth desactivada en producción hasta disponer de HTTPS y dominio real.
- Rate limiting y anti-enumeración de cuentas en todos los endpoints de autenticación.
