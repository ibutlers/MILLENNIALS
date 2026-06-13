# AGENTS.md — Realstate

Reglas obligatorias para agentes/personas.

## Arquitectura permitida
- Monorepo pnpm.
- Frontend: React, Vite, TypeScript, React Router, Tailwind CSS, TanStack Query, React Hook Form, Zod.
- Backend: Node.js, TypeScript, Fastify.
- DB: PostgreSQL.
- Tests: Vitest, Testing Library, Playwright.
- Deploy: Docker Compose con Caddy o Nginx. Por defecto este repo usa Caddy en contenedor.
- Nunca exponer públicamente dashboard, gateway ni API de Hermes.

## Calidad
- TypeScript estricto.
- Validar entradas con Zod.
- Componentes pequeños, accesibles y testeables.
- Actualizar tests y documentación con cada cambio funcional.

## Git
- Trabajar sobre `main`.
- Antes de modificar una `main` con historial funcional crear `git tag recovery/<fecha>-before-<descripcion>`.
- No hacer push sin pasar verificaciones.
- No crear PRs ni ramas salvo instrucción explícita.

## Secretos
- No commitear tokens, claves, `.env` reales ni dumps sensibles.
- Sólo `.env.example` con valores ficticios.
- Si un secreto aparece en historial, parar y rotarlo.

## Verificaciones obligatorias antes del push
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Si afecta UI/navegación/deploy: `pnpm test:e2e`.

## Deploy
1. `git status` limpio en main.
2. Ejecutar verificaciones.
3. `git push origin main`.
4. `./scripts/deploy.sh`.
5. `./scripts/healthcheck.sh`.

## Healthcheck
`/health` debe devolver HTTP 200 y cuerpo `ok` en `http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}/health`.

## Rollback
`./scripts/rollback.sh` restaura la release previa bajo `/srv/deployments/realstate/releases` y reejecuta compose.

## Documentación
Cambios de arquitectura, comandos, variables, deploy, healthcheck o rollback deben actualizar `docs/` y este archivo si aplica.
