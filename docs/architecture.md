# Arquitectura — Realstate

Monorepo pnpm:
- `apps/web`: React + Vite + TypeScript.
- `apps/api`: Fastify + TypeScript.

Servicios Docker Compose previstos:
- `frontend`: assets estáticos Vite servidos por Nginx.
- `api`: Fastify interno en 3001.
- `postgres`: PostgreSQL interno.
- `proxy`: Caddy en `${REALSTATE_HTTP_PORT:-8088}`.

Seguridad: PostgreSQL no se publica, Hermes no se expone y los secretos viven fuera de Git.
