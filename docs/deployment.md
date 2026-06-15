# Procedimiento de despliegue — MILLENNIALS CONSTRUYEN | CAPITAL

## Stack de despliegue

- Docker Compose (proyecto `current`)
- 4 servicios: `postgres`, `api`, `frontend`, `proxy`
- Proxy: Caddy (HTTP → HTTPS futuro)
- Volúmenes persistentes: `current_postgres-data`, `current_caddy-data`, `current_caddy-config`

## Deploy normal

```bash
./scripts/deploy.sh
```

El script:
1. Verifica `git status` limpio y rama `main`
2. Crea backup PostgreSQL (`/srv/backups/realstate/database-YYYYMMDDTHHMMSSZ.dump`)
3. Construye imágenes Docker (api, frontend)
4. Ejecuta migraciones (`pnpm db:migrate`)
5. Ejecuta seed si `DEMO_SEED_ENABLED=true`
6. Activa nueva release (`/srv/deployments/realstate/releases/YYYYMMDDTHHMMSSZ`)
7. Healthcheck: `http://127.0.0.1:8088/health`

## Rollback

```bash
./scripts/rollback.sh
```

Restaura la release anterior y reejecuta `docker compose up -d`.

## Configuración de producción

Variables en `shared/.env` (protegido, permisos 600):

```
DATABASE_URL=postgres://realstate:PASSWORD@postgres:5432/realstate
AUTH_ENABLED=false
REGISTRATION_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
LEADS_ENABLED=false
ADMIN_ENABLED=false
ADMIN_MEDIA_UPLOAD_ENABLED=false
DEMO_SEED_ENABLED=false
```

## Migraciones

- Runner: `apps/api/src/db/migrate.ts`
- Migración baseline: `0001_baseline_definitive.sql` (INMUTABLE)
- Checksum SHA-256: `2e4fab57f6e5227444a7d881243b8d63cddf1a2369ac5c942f1ed0e96fade1f8`
- Advisory lock: `pg_try_advisory_lock(729527002)`
- Solo un migrador puede ejecutarse a la vez
- Migraciones futuras: `0002_*.sql`, `0003_*.sql`, etc.

## Autenticación PostgreSQL

- Método: `scram-sha-256`
- Usuario: `realstate` (sin superusuario)
- PostgreSQL no expuesto al host (solo red Docker interna)
- `pg_hba.conf`: autenticación por contraseña para conexiones TCP
- Las credenciales viajan en `DATABASE_URL` dentro de la red Docker

## Backup

```bash
docker exec current-postgres-1 pg_dump -U realstate -d realstate -Fc -f /tmp/backup.dump
docker cp current-postgres-1:/tmp/backup.dump ./backup-$(date -u +%Y%m%dT%H%M%SZ).dump
```

El deploy script genera backup automático antes de cada despliegue.

## Restauración

```bash
# 1. Terminar conexiones
docker exec current-postgres-1 psql -U realstate -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='realstate';"

# 2. Renombrar base actual
docker exec current-postgres-1 psql -U realstate -d postgres \
  -c "ALTER DATABASE realstate RENAME TO realstate_old;"

# 3. Crear base nueva
docker exec current-postgres-1 psql -U realstate -d postgres \
  -c "CREATE DATABASE realstate OWNER realstate;"

# 4. Restaurar backup
docker exec -i current-postgres-1 pg_restore -U realstate -d realstate < backup.dump

# 5. Verificar
docker exec current-postgres-1 psql -U realstate -d realstate \
  -c "SELECT * FROM schema_migrations;"
```

## Reinicialización desde cero

1. Backup de la base actual
2. Renombrar base → `realstate_broken_YYYYMMDD`
3. Crear base nueva `realstate`
4. Ejecutar runner: `docker run --rm --network current_default -e DATABASE_URL=... node apps/api/dist/db/migrate.js`
5. Ejecutar seed: `DEMO_SEED_ENABLED=true ... node apps/api/dist/db/seed.js`
6. Verificar: `SELECT * FROM schema_migrations;` — exactamente 1 fila

## Flags de producción

| Flag | Producción | E2E/Dev |
|---|---|---|
| `AUTH_ENABLED` | `false` | `true` |
| `REGISTRATION_ENABLED` | `false` | `true` |
| `EMAIL_DELIVERY_ENABLED` | `false` | `false` |
| `LEADS_ENABLED` | `false` | `true` |
| `ADMIN_ENABLED` | `false` | `true` |
| `DEMO_SEED_ENABLED` | `false` | `true` (solo carga inicial) |
