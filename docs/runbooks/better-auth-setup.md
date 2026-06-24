# Better Auth — Configuración y Setup

Versión: **Better Auth v1.6.19** (pin exacto, no flotante)
Fecha de revisión: 2026-06-17
Plugins activos: two-factor, organization

## Activar/Desactivar autenticación

La autenticación se controla mediante `AUTH_MODE` en `shared/.env`:

```bash
# Autenticación deshabilitada (por defecto, segura)
AUTH_MODE=disabled

# Autenticación con Better Auth
AUTH_MODE=better-auth
```

**⚠️ No activar `AUTH_MODE=better-auth` en producción hasta tener:**
- Dominio definitivo con HTTPS
- `BETTER_AUTH_SECRET` con al menos 32 caracteres de entropía
- SMTP configurado y verificado
- SPF, DKIM y DMARC configurados
- Dos cuentas administrativas creadas
- Backup verificado de tablas `auth.*` y `public.app_users`

## Variables requeridas para Better Auth

```bash
# Obligatorias
AUTH_MODE=better-auth
BETTER_AUTH_SECRET=<generar con: openssl rand -base64 48>
BETTER_AUTH_URL=https://<dominio-definitivo>
BETTER_AUTH_TRUSTED_ORIGINS=https://<dominio-definitivo>

# Email (requerido para producción)
AUTH_EMAIL_MODE=smtp
AUTH_EMAIL_FROM=no-reply@<dominio>
SMTP_HOST=<host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<user>
SMTP_PASSWORD=<password>

# Opcionales con defaults seguros
AUTH_INVITATION_TTL_HOURS=48
AUTH_SESSION_EXPIRES_HOURS=8
AUTH_PASSWORD_MIN_LENGTH=12
BETTER_AUTH_COOKIE_PREFIX=mc
BETTER_AUTH_REQUIRE_2FA=false
```

## Esquema PostgreSQL

Better Auth usa el esquema `auth` (separado de `public`):

```
auth.user         — Identidad Better Auth
auth.session      — Sesiones (cookies)
auth.account      — Métodos de auth (email+password)
auth.verification — Tokens de verificación/reset
auth.two_factor   — Configuración TOTP
auth.organization — Organización "MILLENNIALS CONSTRUYEN"
auth.member       — Pertenencia a organización
auth.invitation   — Invitaciones de organización (framework)
```

La autorización local usa tablas en `public`:
- `app_users` — Usuarios internos vinculados 1:1 con auth.user
- `access_invitations` — Invitaciones de acceso (puerta de entrada)
- `project_user_access` — Concesiones de acceso a proyectos
- `auth_audit_events` — Auditoría append-only

## Pool de conexiones

Cada pool PostgreSQL usa `search_path` adecuado:

- **Pool de negocio**: `search_path=public` — consultas de `app_users`, `leads`, `opportunities`, etc.
- **Pool Better Auth**: `search_path=auth,public` — Better Auth resuelve sus tablas primero en `auth.*`

Ambos pools comparten el mismo usuario PostgreSQL (`realstate`) y base de datos.

## Migraciones

Las migraciones están en `apps/api/src/db/migrations/`:
- `0008_add_better_auth_schema.sql` — Esquema `auth` generado desde `getAuthTables()` de v1.6.19
- `0009_add_private_access_authorization.sql` — Autorización local

Se ejecutan automáticamente en `./scripts/deploy.sh` a través del migrador estándar.

**Regla IRON**: Nunca modificar 0001-0007 (checksums registrados). Los cambios van en nuevas migraciones.

## Endpoints

Con `AUTH_MODE=better-auth`:
- `POST /api/auth/*` — Handler Better Auth (sign-up, sign-in, sign-out, etc.)
- `POST /api/auth/sign-up/email` — Protegido: requiere `X-Invitation-Token`
- `GET /api/investor/dashboard` — Dashboard privado del inversor
- `GET /api/investor/projects` — Proyectos autorizados
- `GET /api/investor/projects/:id` — Detalle con autorización SQL
- `GET /api/investor/projects/:id/documents` — Documentos privados
- `GET /api/investor/profile` — Perfil del inversor
- `POST /api/v1/invitations` — Crear invitación (operator/admin)
- `GET /api/v1/invitations` — Listar invitaciones (operator/admin)
- `POST /api/v1/invitations/validate` — Validar invitación (público, sin autenticación)
- `POST /api/v1/invitations/:ref/revoke` — Revocar invitación (operator/admin)

## Actualización de Better Auth

1. Revisar changelog y breaking changes
2. Fijar nueva versión exacta en `apps/api/package.json` y `apps/web/package.json`
3. Regenerar esquema: `npx tsx gen-better-auth-schema.ts` (crear temporalmente)
4. Comparar con `0008_add_better_auth_schema.sql` existente
5. Crear migración aditiva con solo los deltas (nueva tabla, nueva columna, etc.)
6. Actualizar ADR y este runbook
7. Probar en entorno efímero antes de producción

## Rollback

Si Better Auth causa problemas en producción:

1. Cambiar `AUTH_MODE=disabled` en `shared/.env`
2. Ejecutar `./scripts/deploy.sh`
3. Las cookies existentes expirarán (máximo 8 horas)
4. Los datos en `auth.*` y `public.app_users` se conservan
5. `/acceso` vuelve a ser informativa
6. Coinvierte sigue funcionando normalmente
