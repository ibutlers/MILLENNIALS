# MILLENNIALS CONSTRUYEN | CAPITAL

Plataforma de inversión inmobiliaria. Monorepo con API (Fastify + TypeScript), frontend (React + Vite + Tailwind), contratos compartidos (Zod + TypeScript) y despliegue Docker Compose.

## Estado actual (Hito 12)

### Activo en producción
- Catálogo público de oportunidades (4 demo)
- Formularios de leads (captura desactivada: `LEADS_ENABLED=false`)
- Autenticación (desactivada: `AUTH_ENABLED=false`)
- Panel de administración (desactivado: `ADMIN_ENABLED=false`)
- Módulo E2E aislado para testing

### Desactivado por feature flags
Todas las funcionalidades sensibles están desactivadas en producción hasta disponer de HTTPS y conformidad legal:

| Flag | Estado | Descripción |
|------|--------|-------------|
| `AUTH_ENABLED` | `false` | Autenticación y sesiones |
| `REGISTRATION_ENABLED` | `false` | Registro público de usuarios |
| `EMAIL_DELIVERY_ENABLED` | `false` | Envío real de emails |
| `ADMIN_ENABLED` | `false` | Panel de administración |
| `ADMIN_MEDIA_UPLOAD_ENABLED` | `false` | Subida de medios en admin |
| `LEADS_ENABLED` | `false` | Captación de solicitudes |
| `DEMO_SEED_ENABLED` | `false` | Datos demo en producción |

### Proveedores externos — todos desactivados
Ningún proveedor externo está configurado. Todos los adaptadores son `Disabled*Provider` que devuelven `provider_not_configured`:

- **Email:** `DisabledEmailProvider` — sin envío real
- **Storage:** `DisabledStorageProvider` — sin almacenamiento
- **KYC:** `DisabledKycProvider` — sin verificación de identidad
- **Signature:** `DisabledSignatureProvider` — sin firma electrónica
- **Payments:** `DisabledPaymentsProvider` — sin pasarela de pago

La selección se controla mediante variables `PROVIDER_*` (ver `.env.example`).

### Área inversora
Rutas implementadas con estados vacíos honestos (sin datos simulados):

| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/inversores` | Dashboard | Identidad real, sin inversiones ficticias |
| `/inversores/perfil` | Perfil | Datos existentes, campos vacíos indicados |
| `/inversores/cartera` | Cartera | "Todavía no tienes inversiones activas" |
| `/inversores/documentos` | Documentos | "No hay documentos disponibles" |
| `/inversores/verificacion` | KYC | "La verificación todavía no está disponible" |
| `/inversores/oportunidades` | Catálogo | Oportunidades públicas |
| `/inversores/cuenta` | Configuración | Sesiones activas |

## Estructura del proyecto

```
├── apps/
│   ├── api/          # Fastify 5 + TypeScript + PostgreSQL
│   │   └── src/
│   │       ├── auth/            # Autenticación (Argon2id, sesiones, RBAC)
│   │       ├── admin/           # Panel de administración
│   │       ├── investor/        # API privada del inversor
│   │       ├── providers/       # Puertos y adaptadores de proveedores
│   │       ├── opportunities/   # API pública de oportunidades
│   │       ├── leads/           # Captación de leads
│   │       ├── db/              # Pool, migraciones, seed
│   │       └── fixtures/        # Usuarios E2E (solo test)
│   └── web/          # React 19 + Vite + Tailwind + TanStack Query
│       └── src/
│           ├── auth/            # Login, registro, guards, contexto
│           ├── investors/       # Área privada del inversor
│           ├── admin/           # Panel de administración
│           ├── opportunities/   # Catálogo y detalle
│           └── leads/           # Formularios de leads
├── packages/
│   └── contracts/    # Contratos compartidos (Zod + TypeScript)
├── e2e/              # Docker Compose para entorno E2E aislado
├── scripts/          # deploy.sh, test-database.sh, run-e2e.sh
└── docs/             # Documentación técnica
```

## Arquitectura de contratos

`packages/contracts` centraliza schemas Zod y tipos TypeScript compartidos por API y Web:

- `errors.ts` — `errorResponseSchema`, `paginationSchema`, códigos de error de proveedor
- `auth.ts` — `userResponseSchema`, `loginRequestSchema`, `registerRequestSchema`, sesiones, verificación, recuperación
- `opportunities.ts` — `opportunitySummarySchema`, `opportunityDetailSchema`, respuestas, filtros, queries
- `providers.ts` — Schemas para email, storage, KYC, firma, pagos, eventos, health

**Principio:** Una sola forma canónica por respuesta. Sin parsers duplicados. Sin `any` en fronteras HTTP nuevas. Sin compatibilidad silenciosa con formatos antiguos.

## Puertos y adaptadores

Cada integración externa se modela como una interfaz TypeScript (puerto) con un adaptador `Disabled*` que nunca simula éxito:

```
apps/api/src/providers/
├── interfaces.ts     # Puertos tipados (EmailProvider, StorageProvider, …)
├── disabled.ts       # Adaptadores desactivados (nunca simulan éxito)
├── config.ts         # Selección centralizada (env vars PROVIDER_*)
└── index.ts          # Barrel export
```

Para activar un proveedor real: implementar la interfaz correspondiente, registrarlo en `config.ts` y establecer `PROVIDER_*=nombre` en el entorno.

## Comandos

```bash
pnpm install          # Instalar dependencias
pnpm lint             # ESLint en todos los workspaces
pnpm typecheck        # TypeScript --noEmit
pnpm test             # Vitest (unitarios + integración)
pnpm build            # Compilar TypeScript + Vite
pnpm test:e2e         # Playwright E2E (público)
pnpm test:e2e:admin   # Playwright E2E (admin)
./scripts/test-database.sh  # Test canónico de base de datos
./scripts/deploy.sh   # Desplegar a producción
```

## Variables de entorno

Ver `.env.example` para la lista completa sin valores secretos.

## Qué sigue desactivado

- **Inversión real:** No existe flujo de inversión. La cartera y documentos están vacíos porque el producto aún no permite invertir.
- **KYC:** El proveedor de verificación de identidad no está contratado.
- **Firma electrónica:** No hay proveedor de firma configurado.
- **Pasarela de pago:** No está integrada.
- **Envío de emails:** `ConsoleEmailTransport` en desarrollo; `DisabledEmailProvider` en producción.
- **HTTPS:** El despliegue actual usa HTTP plano. Se requiere HTTPS antes de activar `AUTH_ENABLED` en producción.
- **Dominio y DNS:** No gestionados en este hito.
