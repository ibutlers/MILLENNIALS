# Arquitectura final — MILLENNIALS CONSTRUYEN | CAPITAL

## Stack

| Componente | Tecnología |
|---|---|
| API | Node.js 22 + Fastify + TypeScript |
| Frontend | React 19 + Vite + TypeScript |
| Base de datos | PostgreSQL 16 |
| ORM / DB | `pg` (sin ORM pesado) |
| Migraciones | Runner propio con advisory lock + checksum SHA-256 |
| Proxy | Caddy (HTTP → HTTPS futuro) |
| Assets estáticos | nginx |
| Monorepo | pnpm workspaces |
| Despliegue | Docker Compose |

## Estructura del monorepo

```
apps/
  api/          # Fastify API
    src/
      db/       # pool, migrate, seed, migrations/
      auth/     # autenticación (desactivada en prod actual)
      admin/    # panel administrativo (desactivado en prod actual)
      leads/    # leads (desactivado en prod actual)
      opportunities/  # API pública de oportunidades
  web/          # React SPA
    src/
      components/  # componentes compartidos
      opportunities/  # catálogo y ficha
      auth/      # login, register, recovery
      investors/ # zona inversor
      admin/     # panel admin
      leads/     # formulario de leads
```

## Servicios Docker

| Servicio | Imagen | Puerto |
|---|---|---|
| proxy | caddy:2-alpine | 8088→80 |
| api | current-api | 3001 (interno) |
| postgres | postgres:16-alpine | 5432 (interno) |
| frontend | current-frontend | 80 (interno) |

## Desactivado en producción

```
AUTH_ENABLED=false
REGISTRATION_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
LEADS_ENABLED=false
ADMIN_ENABLED=false
ADMIN_MEDIA_UPLOAD_ENABLED=false
DEMO_SEED_ENABLED=false
```

## Pendiente de integración

| Servicio | Estado |
|---|---|
| Email | Interfaz definida, transporte en memoria para tests |
| Almacenamiento (S3) | Interfaz definida, local para desarrollo |
| KYC | Interfaz definida, revisión manual |
| Firma electrónica | Interfaz futura |
| Pagos | Interfaz futura |
| Dominio + HTTPS | Configuración final pendiente |

## Estados de despliegue

- Commit `3a12a9d` — baseline inmutable definitivo
- Tag `pre-hito11-repair-20260615T101339Z`
- Release actual: `20260615T104321Z`
- Release anterior: `20260615T094326Z`
- 3 backups preservados:
  - `database-pre-baseline-20260615T093520Z.dump` (esquema antiguo, 15 tablas + datos)
  - `database-20260615T094326Z.dump` (baseline roto, 28 tablas, vacío)
  - `database-pre-repair-20260615T101339Z.dump` (pre-reparación, 28 tablas, vacío)
