# Realstate

Webapp inmobiliaria para presentar oportunidades de real estate con una base pública institucional, responsive y preparada para una futura zona privada de inversores.

## Estado actual

La aplicación desplegada incluye una landing pública mobile-first refinada con:

- hero visual con imagen arquitectónica generada específicamente para Realstate, overlay oscuro y CTAs jerarquizados;
- identidad propia basada en carbón profundo, marfil cálido, verde mineral y cobre oscuro;
- titulares editoriales con serif contemporánea y UI tecnológica con sans legible;
- narrativa corporativa antes de oportunidades;
- tesis de inversión, metodología, tecnología y análisis;
- indicadores de proceso sin métricas no verificadas;
- oportunidades públicas demo con rentabilidad objetivo estimada, plazo, ticket mínimo, capital objetivo, capital comprometido, estado, nivel de riesgo y progreso;
- menú móvil fullscreen accesible con Escape, foco atrapado, restauración de foco, bloqueo de scroll y selector ES/EN preparado;
- FAQ, CTA de acceso privado futuro y footer;
- página visual 404 para rutas desconocidas;
- metadatos SEO básicos y favicon propio;
- cabeceras de seguridad configuradas en Caddy.

Las oportunidades y cifras visibles son demo y están marcadas como datos ilustrativos. No se publica capital gestionado, rentabilidad histórica, número de proyectos, volumen de análisis, oficinas ni presencia internacional hasta tener datos verificables.

La base de datos, autenticación, CRUD, panel administrativo, captación persistente, catálogo real y zona privada funcional quedan para hitos posteriores.

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
pnpm audit --audit-level=low
bash -n scripts/*.sh
git diff --check
./scripts/deploy.sh
./scripts/healthcheck.sh
./scripts/rollback.sh
```

Ver `AGENTS.md` y `docs/` antes de modificar el proyecto.
