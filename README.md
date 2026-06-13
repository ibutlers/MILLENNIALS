# Realstate

Webapp inmobiliaria para presentar oportunidades de real estate con una base pública profesional, responsive y preparada para catálogo real.

## Estado actual

La aplicación desplegada incluye una landing pública mobile-first con:

- cabecera, navegación y footer;
- hero con propuesta de valor;
- buscador visual de propiedades;
- selector comprar/alquilar, ubicación, tipo y precio máximo;
- propiedades destacadas con datos mock realistas;
- servicios/ventajas;
- CTA de contacto;
- página visual 404 para rutas desconocidas;
- metadatos SEO básicos y favicon propio;
- cabeceras de seguridad configuradas en Caddy.

La base de datos, autenticación, CRUD, panel administrativo y catálogo real quedan para hitos posteriores.

## Stack

React + Vite + TypeScript, React Router, Tailwind CSS, TanStack Query, React Hook Form, Zod, Node.js + Fastify, PostgreSQL, Vitest, Testing Library, Playwright, axe, Docker Compose + Caddy.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
bash -n scripts/*.sh
git diff --check
./scripts/deploy.sh
./scripts/healthcheck.sh
./scripts/rollback.sh
```

Ver `AGENTS.md` y `docs/` antes de modificar el proyecto.
