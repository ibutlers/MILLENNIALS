# Realstate

Webapp inmobiliaria para presentar oportunidades de real estate con una base pública institucional, API pública de oportunidades y preparación para una futura zona privada de inversores.

## Estado actual

La aplicación desplegada incluye:

- landing pública mobile-first con identidad azul petróleo + verde mineral;
- hero visual con imagen arquitectónica generada específicamente para Realstate;
- narrativa corporativa antes de oportunidades;
- tesis de inversión, metodología, tecnología y análisis;
- oportunidades públicas servidas desde PostgreSQL vía `GET /api/v1/opportunities`;
- fichas públicas JSON vía `GET /api/v1/opportunities/:slug`;
- estados loading/error/empty en frontend sin mostrar datos falsos si la API falla;
- rutas informativas honestas de acceso/zona privada futura, sin autenticación simulada;
- modelo PostgreSQL para oportunidades, media, highlights, riesgos e hitos;
- migraciones SQL controladas y seed demo idempotente;
- menú móvil fullscreen accesible;
- página visual 404 para rutas desconocidas;
- cabeceras de seguridad configuradas en Caddy.

Las oportunidades y cifras visibles son demo y están marcadas como datos ilustrativos. No se publica capital gestionado, rentabilidad histórica, número de proyectos reales, oficinas ni presencia internacional hasta tener datos verificables.

No están implementados todavía: autenticación real, KYC, pagos, cartera, inversión real, panel administrativo funcional ni documentos privados.

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
