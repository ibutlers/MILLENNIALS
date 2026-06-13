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
- Trabajar autónomamente sobre `main` salvo instrucción explícita en contra.
- Antes de modificar una `main` con historial funcional crear `git tag recovery/<fecha>-before-<descripcion>`.
- Implementar, probar, documentar, commitear, hacer push y desplegar cuando el objetivo requiera entregar software en producción.
- No hacer push sin pasar verificaciones.
- No crear PRs ni ramas salvo instrucción explícita.

## Secretos
- No commitear tokens, claves, `.env` reales ni dumps sensibles.
- Sólo `.env.example` con valores ficticios.
- Si un secreto aparece en historial, parar y rotarlo.
- Preservar `/srv/deployments/realstate/shared/.env`; no mostrar, copiar ni commitear sus valores.
- No commitear backups, dumps, archivos `.backup` ni temporales.

## Volúmenes y datos
- Preservar los volúmenes de producción `current_*`, especialmente `current_postgres-data`.
- No ejecutar `docker compose down -v` en producción.
- Mantener `COMPOSE_PROJECT_NAME=current` para producción.
- Las migraciones deben ser retrocompatibles con rollback a la release anterior.

## Verificaciones obligatorias antes del push
```bash
pnpm install --frozen-lockfile
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
4. Desplegar producción únicamente con `./scripts/deploy.sh`.
5. Verificar `/health`, `/api/health`, `/`, contenedores, symlinks `current`/`previous`, puerto publicado y volumen `current_postgres-data`.

Una tarea de producción no está terminada hasta que el cambio esté desplegado y verificado en el entorno activo.

## Healthcheck
`/health` debe devolver HTTP 200 y cuerpo `ok` en `http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}/health`.

## Rollback
`./scripts/rollback.sh` restaura la release previa bajo `/srv/deployments/realstate/releases` y reejecuta compose.

## Documentación
Cambios de arquitectura, comandos, variables, deploy, healthcheck o rollback deben actualizar `docs/` y este archivo si aplica.
