# Despliegue — Realstate

Realstate se despliega desde un workspace Git limpio hacia releases inmutables y se ejecuta con Docker Compose y Caddy en contenedor. El puerto público por defecto es `8088` para no interferir con servicios existentes.

## Directorios y enlaces

- Workspace Git: `/srv/workspaces/realstate`.
- Raíz de despliegues: `/srv/deployments/realstate`.
- Releases: `/srv/deployments/realstate/releases/<timestamp-utc>`.
- Release activa: `/srv/deployments/realstate/current` apunta por symlink a una release.
- Release anterior: `/srv/deployments/realstate/previous` apunta por symlink a la release de recuperación inmediata.
- Configuración persistente secreta: `/srv/deployments/realstate/shared/.env`.
- Backups PostgreSQL: `/srv/backups/realstate`.
- Logs de despliegue: `/var/log/realstate`.

El archivo secreto `shared/.env` no vive en Git. Cada release recibe un symlink `.env` hacia `../../shared/.env`; no se deben copiar ni commitear valores reales al repositorio.

## Proyecto Compose fijo

Producción usa siempre el proyecto Compose `current` mediante `--project-name current`. Esto mantiene nombres estables para contenedores y volúmenes, por ejemplo:

- `current-postgres-1`
- `current-api-1`
- `current-frontend-1`
- `current-proxy-1`
- `current_postgres-data`

`.env.example` incluye `COMPOSE_PROJECT_NAME=current`. Si `shared/.env` define otro valor, los scripts abortan para evitar crear volúmenes paralelos o perder el volumen PostgreSQL de producción.

## Despliegue

El único comando autorizado para producción es:

```bash
./scripts/deploy.sh
```

El script:

1. exige estar en `main`, limpio y sincronizado con `origin/main`;
2. valida que exista `/srv/deployments/realstate/shared/.env`;
3. fija permisos `600` sobre el archivo secreto;
4. crea o confirma disponibilidad de PostgreSQL y genera un backup lógico antes de migrar;
5. copia el workspace a una nueva release excluyendo `.git`, `.env`, dependencias, builds, reportes y temporales;
6. valida y construye Compose;
7. ejecuta migraciones PostgreSQL controladas desde la nueva imagen API usando advisory lock;
8. ejecuta el seed demo idempotente;
9. actualiza `previous` hacia la release activa anterior;
10. actualiza `current` hacia la nueva release;
11. recrea contenedores con `docker compose up -d --force-recreate`;
12. ejecuta el healthcheck HTTP.

No usar `docker compose down -v` en producción. No eliminar los volúmenes `current_*`.

## Backups PostgreSQL

Antes de activar una nueva release, `deploy.sh` ejecuta `pg_dump -Fc` dentro de `current-postgres-1` usando `POSTGRES_USER` y `POSTGRES_DB` desde `shared/.env`.

- Los backups se escriben primero como archivo temporal oculto en `/srv/backups/realstate`.
- Después se renombran atómicamente a `database-<timestamp>.dump`.
- Los permisos finales son `600`.

Estos dumps no deben copiarse al repositorio ni a una release. Para restaurar un backup se debe operar explícitamente sobre PostgreSQL y preservar el volumen `current_postgres-data` salvo autorización destructiva expresa.

## Rutas SPA y 404

El frontend se sirve como SPA desde Nginx detrás de Caddy. Las rutas públicas desconocidas muestran una página visual 404 en React, pero mientras no exista SSR o manejo específico en el proxy la respuesta HTTP puede seguir siendo `200` porque Nginx entrega `index.html` mediante `try_files`.

## Cabeceras de seguridad

Caddy añade cabeceras compatibles con la SPA:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` restrictiva para cámara, micrófono, geolocalización y pagos;
- `Content-Security-Policy` con `frame-ancestors 'none'`, `object-src 'none'` y fuentes/scripts limitados a la propia aplicación.

No se activa HSTS mientras la aplicación siga sirviéndose públicamente por HTTP en el puerto `8088`.

## Healthchecks

`./scripts/healthcheck.sh` verifica:

- URL: `http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}/health`.
- Respuesta esperada: HTTP 200 y cuerpo exacto `ok`.
- Reintentos configurables con `REALSTATE_HEALTHCHECK_ATTEMPTS` y `REALSTATE_HEALTHCHECK_SLEEP`.

Después de cada despliegue también se recomienda verificar manualmente:

```bash
curl -fsS http://127.0.0.1:8088/health
curl -fsS http://127.0.0.1:8088/api/health
curl -fsSI http://127.0.0.1:8088/
docker compose --project-name current ps
```

## Rollback automático y manual

Si la activación de una nueva release o su healthcheck falla, `deploy.sh` intenta rollback automático:

1. restaura `current` a la release activa anterior;
2. recrea contenedores desde esa release;
3. vuelve a ejecutar el healthcheck.

Para rollback manual usar:

```bash
./scripts/rollback.sh
```

`rollback.sh` intercambia `current` y `previous`, recrea contenedores con el proyecto Compose fijo `current` y verifica `/health`. Si el rollback manual falla, intenta restaurar la release original y aborta con error.

## Protección de volúmenes

Los volúmenes de producción pertenecen al proyecto Compose `current`. En particular, PostgreSQL debe seguir usando `current_postgres-data`.

Reglas obligatorias:

- no ejecutar `docker compose down -v`;
- no eliminar `current_postgres-data`, `current_caddy-data` ni `current_caddy-config`;
- no cambiar `COMPOSE_PROJECT_NAME` en producción;
- no desplegar con un proyecto Compose distinto;
- no borrar releases como sustituto de rollback.

## Migraciones retrocompatibles

Las migraciones viven en `apps/api/src/db/migrations` y se empaquetan en `apps/api/dist/db/migrations` durante `pnpm --filter @realstate/api build`.

Comandos:

```bash
pnpm --filter @realstate/api db:migrate
pnpm --filter @realstate/api db:seed
./scripts/test-database.sh
```

`deploy.sh` ejecuta `node apps/api/dist/db/migrate.js` y después `node apps/api/dist/db/seed.js` mediante Compose antes de activar la release. Si una migración o seed falla, el despliegue se detiene y no cambia `current`.

El migrador usa `schema_migrations` con checksum SHA-256 y `pg_try_advisory_lock` para evitar dos migradores simultáneos sin bloquear indefinidamente. No hay migraciones destructivas en Hito 2.

Los despliegues deben poder hacer rollback a la release anterior sin perder datos. Cualquier migración de base de datos debe ser retrocompatible durante al menos una release:

- primero agregar columnas/tablas/índices nullable o con defaults seguros;
- desplegar código que soporte el esquema antiguo y nuevo;
- hacer backfills de forma idempotente;
- eliminar columnas o cambiar contratos solo en una release posterior, cuando ya no los use la release anterior;
- documentar comandos manuales y plan de recuperación si una migración no puede ser reversible.

Si una migración no es retrocompatible, detenerse antes del despliegue y solicitar autorización explícita.


## Trazabilidad de commit desplegado

Durante `./scripts/deploy.sh`, después de validar que `main` está limpio y sincronizado con `origin/main`, se calcula el SHA desplegado y se escribe en la nueva release:

```bash
cat /srv/deployments/realstate/current/REVISION
git -C /srv/workspaces/realstate rev-parse HEAD
```

Ambos valores deben coincidir después de un despliegue correcto. `REVISION` contiene únicamente el SHA completo, no secretos ni metadatos sensibles. El script también informa `SHA desplegado: <sha>` durante el deploy.

## Variables opcionales de readiness PostgreSQL

`deploy.sh` acepta variables opcionales para controlar la espera de PostgreSQL antes de backup y migraciones:

```dotenv
REALSTATE_POSTGRES_READY_ATTEMPTS=30
REALSTATE_POSTGRES_READY_SLEEP=2
```

Si no se definen, el script usa sus valores por defecto internos. En producción pueden ajustarse en `/srv/deployments/realstate/shared/.env` sin tocar el repositorio.

## Hito 4 — despliegue de captación

La migración `0002_create_leads.sql` es aditiva y compatible con rollback de la release anterior: no modifica oportunidades existentes y no expone leads por HTTP. El script de deploy sigue creando backup, esperando PostgreSQL, ejecutando migraciones/seed y escribiendo `REVISION` en la release antes de activar `current`.

Variables nuevas:
```dotenv
LEADS_ENABLED=false
PRIVACY_CONTROLLER_NAME=
PRIVACY_CONTACT_EMAIL=
PRIVACY_POLICY_VERSION=2026-06-14
LEADS_RATE_LIMIT_MAX=5
LEADS_RATE_LIMIT_WINDOW_MS=900000
```

`LEADS_ENABLED=false` debe mantenerse en producción hasta disponer de responsable real, correo real de privacidad y versión de política validada. Para verificar trazabilidad tras deploy:
```bash
cat /srv/deployments/realstate/current/REVISION
git -C /srv/workspaces/realstate rev-parse HEAD
```

Comandos operativos locales, no expuestos por HTTP:
```bash
pnpm leads:summary
pnpm leads:list -- --status new --limit 20
pnpm leads:list -- --status new --limit 20 --show-pii
pnpm leads:update -- --reference RS-YYYYMMDD-XXXX --status contacted
```
Por defecto se ocultan email y teléfono y no se imprimen mensajes completos.
