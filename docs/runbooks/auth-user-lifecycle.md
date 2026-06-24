# Ciclo de Vida del Usuario (Better Auth)

## Máquina de Estados

```
╔══════════════════╗
║ Invitación       ║  (access_invitations.status = 'pending')
║ enviada por      ║
║ operator/admin   ║
╚══════╤═══════════╝
       │ Usuario acepta invitación
       ▼
╔══════════════════╗
║ pending_email    ║  Cuenta Better Auth creada. Email sin verificar.
╚══════╤═══════════╝
       │ Verifica email
       ├───────────────► active  (`BETTER_AUTH_REQUIRE_2FA=false`)
       │
       ▼
╔══════════════════╗
║ pending_mfa      ║  Solo si MFA obligatorio: TOTP pendiente.
╚══════╤═══════════╝
       │ Configura y verifica TOTP
       ▼
╔══════════════════╗
║     active       ║  Acceso completo al área del inversor.
╚══════╤═══════════╝
       │
  ┌────┴────┐
  ▼         ▼
╔══════╗ ╔════════╗
║ susp ║ ║revoked ║
╚══════╝ ╚════════╝
  │ (reversible)
  ▼
╔══════╗
║active║ (reactivación)
╚══════╝
```

## Transiciones

| Desde | Hasta | Quién | Condiciones |
|---|---|---|---|
| (nada) | pending_email | Sistema | Invitación válida + sign-up exitoso |
| pending_email | active | Usuario | Verifica email con `BETTER_AUTH_REQUIRE_2FA=false` |
| pending_email | pending_mfa | Usuario | Verifica email con `BETTER_AUTH_REQUIRE_2FA=true` |
| pending_mfa | active | Usuario | Configura TOTP cuando MFA es obligatorio |
| active | active | Usuario | Configura TOTP opcional; se rellena `mfa_enabled_at` tras verificación real |
| active | suspended | Operator/Admin | Manual |
| suspended | active | Operator/Admin | Manual |
| active | revoked | Admin | Manual (irreversible) |
| pending_email | revoked | Admin | Manual |
| pending_mfa | revoked | Admin | Manual |

## Suspensión

La suspensión:
- Cambia `app_users.status = 'suspended'`
- Revoca TODAS las sesiones Better Auth del usuario
- Bloquea acceso inmediato a la API (middleware `requireActiveAppUser`)
- Envía notificación por email
- Conserva la cuenta, invitaciones, accesos e historial
- Es reversible

**Comando:**
```bash
./scripts/auth/suspend-user.sh <email>
```

## Reactivación

- Restaura `status = 'active'`
- NO restaura accesos a proyectos revocados explícitamente
- El usuario deberá iniciar sesión de nuevo
- Requiere autorización operator/admin
- Auditoría obligatoria

**Comando:**
```bash
./scripts/auth/reactivate-user.sh <email>
```

## Revocación

La revocación es IRREVERSIBLE:
- `app_users.status = 'revoked'`
- Revoca todas las sesiones
- Revoca TODOS los accesos a proyectos
- Anula invitaciones pendientes
- Conserva historial de auditoría
- No se puede reactivar

**Comando:**
```bash
./scripts/auth/revoke-user.sh <email> --yes
```

## Verificación de Email

- Better Auth envía enlace de verificación por email
- `emailVerification.expiresIn` = configurable
- `autoSignInAfterVerification = false` (forzamos flujo controlado)
- Estado local `email_verified_at` se actualiza tras verificación

## MFA (TOTP)

- Opcional por defecto (`BETTER_AUTH_REQUIRE_2FA=false`)
- Obligatorio solo si `BETTER_AUTH_REQUIRE_2FA=true`
- `skipVerificationOnEnable = false` (debe verificar antes de activar)
- Códigos de recuperación: 10 códigos, se muestran UNA SOLA VEZ
- El endpoint de deshabilitar 2FA está bloqueado para inversores
- `requireMfa` middleware verifica estado real de Better Auth, no solo `mfa_enabled_at`

## Sesiones

- Máximo: 8 horas (`AUTH_SESSION_EXPIRES_HOURS`)
- Cookie: `HttpOnly`, `Secure` (con HTTPS), `SameSite=Lax`
- Prefijo: `mc` (configurable)
- Revocación inmediata al:
  - Suspender
  - Revocar
  - Cambiar/Resetear contraseña
  - Logout
- No se almacena IP en la sesión sin justificación legal

## Cambio de Rol

- Solo admin
- Nunca desde el frontend
- Confirmación requerida
- Auditoría obligatoria
- No puede eliminar el último admin sin procedimiento de emergencia

**Estados alternativos:** Si un usuario es eliminado de Better Auth manualmente, queda bloqueado localmente. Ejecutar `./scripts/auth/reconcile-user.sh <email>` para auditar y corregir el estado.
