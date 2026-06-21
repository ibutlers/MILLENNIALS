# Runbook — Segundo administrador real

Estado: preparado, pendiente de `ADMIN_EMAIL_2` real.

Este procedimiento crea un segundo administrador **real** mediante el flujo oficial de invitación. No usa SQL manual para crear usuarios, no crea admins ficticios y no imprime tokens ni enlaces completos.

## Precondiciones

- Producción está en modo Better Auth:
  - `AUTH_MODE=better-auth`
  - `AUTH_EMAIL_MODE=smtp`
  - `ADMIN_ENABLED=true`
  - `BETTER_AUTH_REQUIRE_2FA=false` mientras MFA siga siendo opcional por decisión de producto.
- Repo servidor limpio y sincronizado:
  ```bash
  ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate 'cd /srv/workspaces/realstate && git status --short --branch'
  ```
- El admin inicial sigue activo y no se revoca durante este procedimiento.
- Existe un email humano real para el segundo admin (`ADMIN_EMAIL_2`). No usar `test@example.com`, dominios `.test`, `.invalid`, `.example`, ni emails inventados.
- No debe existir otra invitación `pending` para ese email.

## Flujo oficial correcto

1. Crear una invitación `intended_role=admin` con el helper oficial.
2. El helper envía el email por el proveedor configurado si `AUTH_EMAIL_MODE=smtp`.
3. La persona abre el email y activa la cuenta desde `/acceso/activar`.
4. Better Auth registra el usuario con contraseña.
5. El backend consume la invitación y asigna `role=admin` server-side desde `access_invitations.intended_role`.
6. El usuario queda `status=active` cuando el email está verificado. MFA no bloquea si `betterAuthRequire2FA=false`.
7. Probar login con email/contraseña.
8. Probar logout.
9. Revisar auditoría sin imprimir tokens ni enlaces completos.

## Comando exacto para invitar el segundo admin

Primero hacer preflight sin persistir:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/invite-admin.sh --email \"$ADMIN_EMAIL_2\" --dry-run"
```

Si el preflight devuelve OK y Víctor ha confirmado el email real:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/invite-admin.sh --email \"$ADMIN_EMAIL_2\" --yes"
```

Salida esperada:

- `✓ Invitación admin creada: INV-...`
- email enmascarado salvo que se use `--pii` deliberadamente;
- `Rol: admin`;
- `Correo enviado: sí` si `AUTH_EMAIL_MODE=smtp`;
- ningún token;
- ningún enlace completo.

## Cómo validar que el email se envió

Sin abrir ni imprimir el email:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/list-invitations.sh --email \"$ADMIN_EMAIL_2\" --status pending --limit 5"
```

Debe aparecer una única invitación `pending` con `intended_role=admin` y referencia pública `INV-...`.

Para auditoría de envío:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/audit-log.sh --subject \"$ADMIN_EMAIL_2\" --action admin_invitation_email_sent --limit 5"
```

La salida debe mostrar `admin_invitation_email_sent` con metadata enmascarada por defecto. No usar `--pii` salvo necesidad operativa explícita.

## Cómo completar activación

Acción humana del segundo admin:

1. Abrir el email de invitación recibido.
2. Hacer clic en el botón de activación. No copiar el enlace al chat.
3. Completar registro con contraseña segura.
4. Verificar email si el flujo lo solicita.
5. Iniciar sesión en `/acceso/login`.
6. Entrar a `/admin`.
7. MFA es opcional por ahora; puede configurarse en `/acceso/2fa` como seguridad adicional, pero no es requisito mientras `betterAuthRequire2FA=false`.

## Cómo verificar role/status

Después de que la persona confirme que activó la cuenta:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/list-users.sh --email \"$ADMIN_EMAIL_2\" --role admin --status active --limit 5"
```

Debe aparecer exactamente ese usuario, enmascarado por defecto, con:

- `role=admin`;
- `status=active`.

También comprobar que la invitación pasó a `accepted`:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/list-invitations.sh --email \"$ADMIN_EMAIL_2\" --status accepted --limit 5"
```

## Cómo probar login

Prueba humana:

1. Abrir `/acceso/login`.
2. Entrar con `ADMIN_EMAIL_2` y la contraseña definida.
3. Confirmar que `/admin` carga.
4. Confirmar que no aparece bloqueo `mfa_required` mientras `betterAuthRequire2FA=false`.

Prueba técnica sin cookies impresas:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate '
set -euo pipefail
BASE=http://127.0.0.1:8088
curl -s -o /dev/null -w "login=%{http_code}\n" "$BASE/acceso/login"
curl -s -o /dev/null -w "admin=%{http_code}\n" "$BASE/admin"
curl -s -o /dev/null -w "me_no_cookie=%{http_code}\n" "$BASE/api/auth/me"
'
```

## Cómo probar logout

Prueba humana:

1. Desde `/admin`, usar “Cerrar sesión”.
2. Confirmar redirección o ausencia de sesión.
3. Volver a `/admin`; debe exigir login.

No imprimir cookies ni cabeceras `Set-Cookie`.

## Cómo revocar sesiones si hace falta

Solo si hay una incidencia de sesión o si Víctor lo pide explícitamente:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/revoke-user-sessions.sh \"$ADMIN_EMAIL_2\" --yes"
```

Esto no borra el usuario ni cambia el rol. Solo elimina sesiones Better Auth activas y registra auditoría.

## Auditoría

Eventos esperados:

- `invitation_created` sobre `access_invitation`;
- `admin_invitation_email_sent` si el proveedor envió correo;
- `invitation_accepted` al completar activación;
- `email_verified` al verificar email;
- eventos de sesión si se revocan sesiones.

Comando:

```bash
ADMIN_EMAIL_2='persona.real@dominio-real.com'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/audit-log.sh --subject \"$ADMIN_EMAIL_2\" --limit 20"
```

La salida enmascara emails por defecto y no debe mostrar tokens, enlaces completos, cookies ni secretos.

## Rollback

### Si la invitación se creó pero no se usó

Revocar la invitación por referencia pública:

```bash
INV_REF='INV-YYYYMMDD-XXXXXX'
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  "cd /srv/workspaces/realstate && ./scripts/auth/revoke-invitation.sh \"$INV_REF\" --reason 'Segundo admin pospuesto' --yes"
```

### Si el email no llega

1. No crear otra invitación inmediatamente.
2. Confirmar que existe una única invitación `pending`:
   ```bash
   ./scripts/auth/list-invitations.sh --email "$ADMIN_EMAIL_2" --status pending --limit 5
   ```
3. Revisar health SMTP sin imprimir credenciales.
4. Revisar carpeta spam/promociones del buzón.
5. Si hay que reenviar, usar solo el procedimiento oficial que no imprima token. Si no existe reenviador seguro, revocar la invitación y crear una nueva con `invite-admin.sh`.

### Si la invitación expira

1. Confirmar `status=expired` o ausencia de `pending`.
2. Crear una nueva invitación con `invite-admin.sh --email "$ADMIN_EMAIL_2" --yes`.
3. No reutilizar tokens antiguos.

### Si el usuario queda parcial

Estados posibles:

- `pending_email`: pedir al usuario que complete verificación email.
- `pending_mfa`: solo bloquea si en el futuro se activa MFA obligatorio; con `betterAuthRequire2FA=false` no debe bloquear admin si el usuario está activo/verificado.
- usuario creado pero sin rol admin: no arreglar por SQL manual; diagnosticar consumo de invitación y reconciliar con scripts oficiales o fix de backend.

Antes de cualquier corrección destructiva, hacer backup y pedir autorización explícita si afecta usuarios reales.

## Qué no hacer

- No SQL manual para crear admins.
- No crear admin ficticio.
- No imprimir token.
- No imprimir enlace completo.
- No imprimir cookies.
- No crear varias invitaciones activas para el mismo email.
- No revocar ni degradar el admin inicial.
- No activar `BETTER_AUTH_REQUIRE_2FA=true` por esta tarea.
- No cambiar `.env` ni flags críticos.
- No tocar `current_postgres-data`.
- No usar `docker compose down -v` ni `docker system prune -a`.

## Estado pendiente

`WAITING_HUMAN: proporcionar ADMIN_EMAIL_2`.

Mientras falte ese dato, solo queda pendiente la creación real. El resto del tablero puede avanzar.
