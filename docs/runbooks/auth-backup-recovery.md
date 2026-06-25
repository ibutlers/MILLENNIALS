# Backup y Recuperación — Tablas de Autenticación

## Alcance del backup

El backup de producción debe incluir:
- Esquema `auth` (Better Auth: user, session, account, verification, two_factor, organization, member, invitation)
- `public.app_users` (usuarios internos)
- `public.access_invitations` (invitaciones de acceso)
- `public.project_user_access` (concesiones de acceso)
- `public.auth_audit_events` (auditoría)
- `public.schema_migrations` (tracking de migraciones)

## Backup

### Backup completo (recomendado)

```bash
docker exec current-postgres-1 pg_dump -U realstate realstate \
  --format=custom \
  --file=/tmp/realstate-backup-$(date +%Y%m%d-%H%M%S).dump
docker cp current-postgres-1:/tmp/realstate-backup-*.dump ./backups/
```

### Backup solo de auth

```bash
docker exec current-postgres-1 pg_dump -U realstate realstate \
  --schema=auth \
  --table=public.app_users \
  --table=public.access_invitations \
  --table=public.project_user_access \
  --table=public.auth_audit_events \
  --format=custom \
  --file=/tmp/auth-backup-$(date +%Y%m%d-%H%M%S).dump
docker cp current-postgres-1:/tmp/auth-backup-*.dump ./backups/
```

## Restore

### Restore completo

```bash
# 1. Detener API y Frontend (mantener PostgreSQL)
docker compose stop api frontend proxy

# 2. Restaurar
docker exec -i current-postgres-1 pg_restore -U realstate -d realstate \
  --clean --if-exists --no-owner < ./backups/realstate-backup-XXXX.dump

# 3. Aplicar migraciones (idempotente)
docker compose run --rm api node apps/api/dist/db/migrate.js

# 4. Verificar integridad
docker exec current-postgres-1 psql -U realstate -d realstate -c \
  "SELECT id, checksum FROM schema_migrations ORDER BY id;"

# 5. Rearrancar
docker compose up -d
```

### Post-restore — Verificaciones obligatorias

```sql
-- 1. Los usuarios revocados siguen revocados
SELECT count(*) FROM app_users WHERE status = 'revoked';

-- 2. Los usuarios suspendidos siguen suspendidos
SELECT count(*) FROM app_users WHERE status = 'suspended';

-- 3. Las invitaciones expiradas siguen expiradas
SELECT count(*) FROM access_invitations WHERE status = 'expired';

-- 4. Los accesos revocados siguen revocados
SELECT count(*) FROM project_user_access WHERE status = 'revoked';

-- 5. Las sesiones antiguas NO se consideran válidas
-- (Better Auth firma las cookies con BETTER_AUTH_SECRET — si es el mismo, las sesiones son válidas)
-- Si se rotó el secreto, todas las sesiones se invalidan automáticamente.
SELECT count(*) FROM auth.session WHERE expires_at > now();

-- 6. Ningún proyecto nuevo fue concedido accidentalmente
-- (el restore no debe modificar project_user_access más allá de lo restaurado)

-- 7. Conciliación de identidades
SELECT au.email_normalized, bu.email
FROM app_users au
LEFT JOIN auth.user bu ON au.better_auth_user_id = bu.id
WHERE bu.id IS NULL AND au.better_auth_user_id IS NOT NULL;
-- Si devuelve filas, hay usuarios huérfanos → ejecutar reconcile-user.sh
```

## Restore en entorno efímero (prueba antes de producción)

```bash
# 1. Crear PostgreSQL efímero
docker run -d --name pg-restore-test \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=realstate_test \
  -p 54399:5432 postgres:17

# 2. Restaurar backup
docker exec -i pg-restore-test pg_restore -U postgres -d realstate_test \
  --no-owner < ./backups/realstate-backup-XXXX.dump

# 3. Verificar
docker exec pg-restore-test psql -U postgres -d realstate_test -c \
  "SELECT count(*) FROM app_users; SELECT count(*) FROM auth.session;"

# 4. Limpiar
docker rm -f pg-restore-test
```

## Frecuencia

- Backup diario automático (configurar cron si se requiere alerta continua)
- Backup antes de cada deploy con migraciones nuevas
- Backup antes de cualquier operación manual en BD
- Backup específico de `/srv/deployments/realstate/shared/.env` antes de editar flags
- Retener últimos 30 backups

## Check operacional read-only

Para auditar backups sin imprimir secretos ni tocar datos:

```bash
scripts/ops/check-backups.sh
```

El script comprueba conteos, edad, tamaño, permisos y lectura estructural del último dump con `pg_restore --list` si está disponible. No imprime contenido de `.env` ni valores sensibles.

## No hacer

- No restaurar solo tablas `auth.*` sin `public.app_users` (las FKs se rompen)
- No restaurar sobre una BD con migraciones diferentes sin aplicar migraciones después
- No eliminar backups antiguos sin verificar que los recientes son válidos
- No usar `docker compose down -v` en producción
