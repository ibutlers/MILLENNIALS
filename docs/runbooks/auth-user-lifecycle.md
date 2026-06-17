# Ciclo de Vida del Usuario (Better Auth)

## Máquina de Estados

```
╔══════════════════╗
║ Invitación       ║  (access_invitations.status = 'pending')
║ enviada por      ║
║ staff/admin      ║
╚══════╤═══════════╝
       │ Usuario acepta invitación
       ▼
╔══════════════════╗
║ pending_email    ║  Cuenta Better Auth creada. Email sin verificar.
╚══════╤═══════════╝
       │ Verifica email
       ▼
╔══════════════════╗
║ pending_mfa      ║  Email verificado. TOTP pendiente.
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
| pending_email | pending_mfa | Usuario | Verifica email |
| pending_mfa | active | Usuario | Configura TOTP |
| active | suspended | Staff/Admin | Manual |
| suspended | active | Staff/Admin | Manual |
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
- Requiere autorización staff/admin
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

- Obligatorio para todos los usuarios
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
