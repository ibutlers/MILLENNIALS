# Seguridad — MILLENNIALS CONSTRUYEN | CAPITAL

## Autenticación PostgreSQL

- PostgreSQL **no está expuesto al host** (puerto 5432 solo en red Docker interna)
- Autenticación mediante `scram-sha-256`
- Usuario de aplicación `realstate` sin privilegios de superusuario
- `DATABASE_URL` con credenciales gestionada vía `shared/.env` (permisos restrictivos)
- No se usa `trust` en producción

## Secretos

- `.env` real en `/srv/deployments/realstate/shared/.env` con permisos `0600`
- Solo `.env.example` en el repositorio con valores ficticios
- No commitear tokens, claves, dumps ni backups
- Rotar secreto si aparece en historial

## API

- Rate limiting en endpoints de autenticación y leads
- Validación Zod de todas las entradas
- Consultas SQL parametrizadas (sin SQL dinámico inseguro)
- Tamaño máximo de página limitado
- Timeout de consultas (5s por defecto)
- Mensajes de error públicos sin información interna
- Códigos de error tipados (`err_auth_disabled`, `err_admin_disabled`, etc.)

## Panel administrativo

- Desactivado en producción (`ADMIN_ENABLED=false`)
- Requiere `AUTH_ENABLED=true` y `APP_BASE_URL` con `https://`
- RBAC en backend (no confiar en ocultar botones del frontend)
- Operadores no pueden gestionar roles ni deshabilitar administradores
- Último admin activo no puede ser deshabilitado

## Autenticación de usuarios

- Contraseñas: Argon2id
- Sesiones: token hash, TTL configurable, idle TTL
- Rate limiting por endpoint
- Mensajes genéricos en login/registro/recuperación
- `AUTH_ENABLED=false` en producción actual (sin HTTPS ni dominio)

## Producción actual

```
AUTH_ENABLED=false
REGISTRATION_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
LEADS_ENABLED=false
ADMIN_ENABLED=false
ADMIN_MEDIA_UPLOAD_ENABLED=false
DEMO_SEED_ENABLED=false
```

## Migraciones

- Baseline `0001_baseline_definitive.sql` inmutable
- Runner exclusivo de `schema_migrations` con PK
- Advisory lock (no dos migradores simultáneos)
- Ejecución en transacción con rollback
- Checksum SHA-256 validado — no repara automáticamente
- Prohibido insertar manualmente en `schema_migrations`

## Headers HTTP

- Content-Security-Policy restrictiva
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: sin cámara, micrófono, geolocalización, pagos
- Frame-Ancestors: none

## Backups

- Backup automático en cada despliegue (`./scripts/deploy.sh`)
- Formato: `pg_dump -Fc` (custom, comprimido)
- Conservar backups históricos
- Verificar `pg_restore --list` antes de considerar válido

## pg_hba.conf

```
local   all   all           trust     # Unix socket
host    all   all   127.0.0.1/32  trust     # localhost
host    all   all   ::1/128       trust     # localhost IPv6
host    all   all   all           scram-sha-256  # Docker network
```

Sin líneas `trust` para redes externas.
