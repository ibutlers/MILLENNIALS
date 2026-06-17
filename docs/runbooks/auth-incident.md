# Respuesta a Incidentes de Autenticación

## Niveles de severidad

| Nivel | Descripción | Acción inmediata |
|---|---|---|
| P1 | Token/filtración de secreto, cuenta admin comprometida | Rotar secreto, revocar sesiones, modo disabled |
| P2 | Intento de acceso masivo, fuerza bruta | Revisar rate limits, bloquear IPs sospechosas |
| P3 | Error de configuración, email no entregado | Revisar logs, verificar SMTP |

## P1: Token de invitación filtrado

**Síntoma**: Un enlace de invitación aparece en logs, Slack, o se comparte accidentalmente.

**Respuesta**:
1. Revocar la invitación inmediatamente:
   ```bash
   ./scripts/auth/revoke-invitation.sh <REF> --reason "token_filtrado" --yes
   ```
2. Verificar que no se creó una cuenta con ese token:
   ```sql
   SELECT * FROM access_invitations WHERE public_reference = '<REF>';
   -- Si status = 'accepted', el token fue usado
   ```
3. Si se creó una cuenta no autorizada:
   ```bash
   ./scripts/auth/revoke-user.sh <email> --yes
   ```
4. Rotar `BETTER_AUTH_SECRET` (ver procedimiento abajo)
5. Documentar el incidente en `auth_audit_events`

## P1: BETTER_AUTH_SECRET comprometido

**Síntoma**: El secreto aparece en logs, GitHub, o se sospecha exposición.

**Respuesta**:
1. Generar nuevo secreto:
   ```bash
   openssl rand -base64 48
   ```
2. Actualizar `shared/.env`: `BETTER_AUTH_SECRET=<nuevo>`
3. Desplegar inmediatamente: `./scripts/deploy.sh`
4. Esto invalida TODAS las sesiones existentes (las cookies se firman con el secreto)
5. Los usuarios deberán iniciar sesión de nuevo
6. Verificar que no hay sesiones huérfanas:
   ```sql
   SELECT count(*) FROM auth.session WHERE expires_at > now();
   ```
7. Revocar todas las sesiones explícitamente:
   ```bash
   # Para cada usuario activo:
   ./scripts/auth/revoke-sessions.sh <email>
   ```

## P1: Cuenta administrativa comprometida

**Síntoma**: Actividad sospechosa en `auth_audit_events`, accesos no autorizados.

**Respuesta**:
1. Suspender la cuenta inmediatamente:
   ```bash
   ./scripts/auth/suspend-user.sh <email> --yes
   ```
2. Revocar todas sus sesiones:
   ```bash
   ./scripts/auth/revoke-sessions.sh <email> --yes
   ```
3. Revisar auditoría de acciones recientes:
   ```bash
   ./scripts/auth/audit-log.sh --actor <email> --since "1 hour ago"
   ```
4. Revocar invitaciones creadas por el actor comprometido:
   ```sql
   UPDATE access_invitations SET status = 'revoked'
   WHERE created_by = '<app_user_id>' AND status = 'pending';
   ```
5. Rotar `BETTER_AUTH_SECRET`
6. Rotar credenciales de base de datos
7. Crear nueva cuenta admin limpia
8. Documentar el incidente

## P2: Ataque de fuerza bruta

**Síntoma**: Múltiples 401/429 en logs, rate limits activándose.

**Respuesta**:
1. Los rate limits de Better Auth ya están activos (memoria, 10 req/15 min)
2. Identificar fuente: revisar logs de `POST /api/auth/sign-in/email`
3. Si es necesario, bajar temporalmente el límite:
   ```bash
   AUTH_RATE_LIMIT_MAX=3  # en shared/.env
   ```
4. No exponer IPs en logs sin decisión legal
5. Las cuentas no se bloquean automáticamente (MVP) — monitorizar manualmente

## P2: Enumeración de emails

Better Auth v1.6.19 tiene protección anti-enumeración por defecto:
- Login: mensaje genérico si email existe o no
- Sign-up protegido por invitación (no expone si email existe)
- Recuperación: mensaje genérico

Verificar que las respuestas son idénticas independientemente de si el email existe:
```bash
curl -s -X POST https://.../api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"existe@test.com","password":"wrong"}' | jq
curl -s -X POST https://.../api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"noexiste@test.com","password":"wrong"}' | jq
# Las respuestas deben ser idénticas
```

## Rollback de emergencia a AUTH_MODE=***

Si Better Auth causa problemas graves:

1. Editar `shared/.env`:
   ```bash
   AUTH_MODE=***
   ```
2. Desplegar: `./scripts/deploy.sh`
3. Las cookies expirarán en máximo 8 horas
4. El área del inversor queda inaccesible (503)
5. `/acceso` vuelve a ser informativa
6. Coinvierte sigue operativo
7. Los datos permanecen intactos

## Logs a revisar

- `docker compose logs api | grep "auth"` — logs de la API
- `docker compose logs api | grep "better-auth"` — logs de Better Auth
- Tabla `auth_audit_events` — auditoría persistente
- Rate limits: logs con `"rateLimit"` o código 429

## Contactos de emergencia

- Desarrollador principal: Víctor Pérez
- Hosting: Hetzner (65.108.251.196)
- Base de datos: PostgreSQL (contenedor `current-postgres-1`)
