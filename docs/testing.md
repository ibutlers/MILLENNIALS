# Estrategia de testing — MILLENNIALS CONSTRUYEN | CAPITAL

## Tests unitarios y de integración

| Suite | Framework | Archivos | Tests |
|---|---|---|---|
| API | Vitest | 8 archivos | 69 tests |
| Web | Vitest + Testing Library | 6 archivos | 19 tests |
| **Total** | | **14 archivos** | **88 tests** |

### API tests

- `migration.test.ts` — Baseline inmutable, runner-owned tracking, sin INSERT en SQL, sin IF NOT EXISTS, checksum
- `auth.test.ts` — Registro, login, verificación, recuperación, sesiones
- `admin.test.ts` — CRUD oportunidades, workflow editorial, sub-entidades, preview
- `leads.test.ts` — Creación, asignación, notas, estados
- `app.test.ts` — Health checks, CORS, rate limiting
- `finance.test.ts` — Serialización de céntimos, basis points, progreso
- `seed.test.ts` — Idempotencia, oportunidades demo
- `image-artifacts.test.ts` — Artefactos en imagen Docker (migrate.js, seed.js, baseline SQL, checksum)

### Web tests

- `App.test.tsx` — Landing pública, estados loading/error/vacío, disclaimer
- `OpportunitiesCatalogPage.test.tsx` — Renderizado de catálogo, métricas financieras, progreso
- `OpportunityDetailPage.test.tsx` — Ficha completa, highlights, riesgos, hitos, media
- `LeadFormPage.test.tsx` — Estado honesto cuando leads desactivados
- `PlannedAccess.test.tsx` — Acceso planificado sin simular autenticación
- `metadata.test.ts` — Meta tags, título, descripción

## E2E tests

### E2E público (`pnpm test:e2e`)
- Homepage consume API real
- Catálogo público con oportunidades
- Oportunidad privada excluida
- Ficha de oportunidad
- Enlaces/CTA funcionales
- `/health` y `/api/health` correctos
- Estados loading, error, vacío

### E2E administrativo (`pnpm test:e2e:admin`)
- Runner + baseline desde base vacía
- Seed idempotente
- Registro y verificación de email
- Login y recuperación de contraseña
- Leads
- Área privada vacía real
- Operator: crear/editar/preview/publicar/retirar/restaurar oportunidad
- Admin: gestión de usuarios, roles, sesiones
- Auditoría
- Teardown garantizado

## Entorno de validación aislada

El E2E administrativo usa:
- Proyecto Compose `realstate-e2e` (aislado de `current`)
- PostgreSQL efímero
- Auth, admin, leads habilitados
- Correo en memoria
- Puertos solo en `127.0.0.1`
- Teardown vía trap EXIT

## Test de build de imagen

`image-artifacts.test.ts` verifica que la imagen Docker contiene:
- `apps/api/dist/db/migrate.js`
- `apps/api/dist/db/seed.js`
- `apps/api/dist/db/migrations/0001_baseline_definitive.sql`
- Checksum del baseline coincide con el archivo fuente

Falla si falta cualquier artefacto.

## Ejecución

```bash
pnpm test          # unitarios + integración
pnpm test:e2e      # E2E público
pnpm test:e2e:admin # E2E administrativo
```
