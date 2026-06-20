# Flujo MFA real para administradores

Fecha: 2026-06-20

## Objetivo

El panel administrativo debe requerir MFA real cuando `BETTER_AUTH_REQUIRE_2FA=true`, sin bypass, sin cambios manuales de SQL y sin marcar estados de Better Auth a mano.

## Estado legacy recuperable

Puede existir una cuenta admin creada mientras MFA era opcional:

- `auth.user` existe y `email_verified=true`.
- `app_users` existe, enlazado por `better_auth_user_id`.
- `app_users.role='admin'` y `app_users.status='active'`.
- `auth.user."twoFactorEnabled"=false`.
- `auth."twoFactor"` puede tener una fila parcial con `verified=false`.
- `app_users.mfa_enabled_at` puede ser `NULL`.

Ese estado es recuperable. No requiere nueva invitación ni SQL manual.

## Flujo correcto

1. El admin inicia sesión en `/acceso/login`.
2. Si Better Auth detecta MFA ya configurado, devuelve `twoFactorRedirect` y la UI abre `/acceso/2fa?modo=challenge&retorno=...`.
3. Si el admin está autenticado pero no tiene MFA completado, el panel admin devuelve `mfa_required` y la UI muestra CTA hacia `/acceso/2fa?retorno=/admin`.
4. `/acceso/2fa` permite configurar TOTP aunque MFA todavía no sea obligatorio globalmente.
5. El usuario introduce su contraseña real en `twoFactor.enable`.
6. La UI muestra un QR TOTP local, clave manual y códigos de recuperación devueltos por Better Auth.
7. El usuario verifica con `twoFactor.verifyTotp`.
8. La UI llama a `/api/auth/reconcile-mfa`.
9. `reconcile-mfa` solo actualiza `app_users.mfa_enabled_at` cuando Better Auth ya reporta `auth.user."twoFactorEnabled"=true`.
10. El admin vuelve a `/admin` y el dashboard queda accesible.

## Reglas de seguridad

- No forzar `auth.user."twoFactorEnabled"` por SQL.
- No marcar `auth."twoFactor".verified` por SQL.
- No insertar ni imprimir secrets TOTP, backup codes, cookies o tokens.
- No crear una nueva invitación si la cuenta existente es recuperable.
- No activar `BETTER_AUTH_REQUIRE_2FA=true` en producción si el único admin real no ha completado TOTP, salvo coordinación humana para escanear QR/introducir código.

## Comprobaciones esperadas

Sin cookie:

- `/api/auth/me` → `401`.
- `/api/v1/admin/dashboard` → `401` o `403`.

Con sesión admin activa pero sin MFA y `BETTER_AUTH_REQUIRE_2FA=true`:

- `/api/v1/admin/dashboard` → `403 mfa_required`.
- `/admin` muestra “Verificación en dos pasos requerida”.
- CTA a `/acceso/2fa?retorno=/admin`.

Después de `twoFactor.enable` + `twoFactor.verifyTotp` + `reconcile-mfa`:

- `auth.user."twoFactorEnabled"=true`.
- `auth."twoFactor".verified=true`.
- `app_users.mfa_enabled_at IS NOT NULL`.
- `/api/v1/admin/dashboard` → `200` para rol `admin`.

## Activación obligatoria futura

Para exigir MFA globalmente:

1. Confirmar que al menos un admin real puede completar MFA desde la UI.
2. Hacer backup de `/srv/deployments/realstate/shared/.env`.
3. Cambiar `BETTER_AUTH_REQUIRE_2FA=true` solo con autorización humana porque afecta acceso real.
4. Desplegar con `./scripts/deploy.sh`.
5. Smoke:
   - `/health`.
   - `/api/health`.
   - `/acceso/login`.
   - `/admin`.
   - `/api/auth/me` sin cookie → `401`.
   - `/api/v1/admin/dashboard` sin cookie → `401/403`.
   - `current_postgres-data` intacto.
   - recursos E2E = 0.

## Recovery

Si un admin pierde acceso por MFA:

- Usar códigos de recuperación si están guardados.
- Si no hay códigos o TOTP válido, ejecutar solo un procedimiento de reset MFA aprobado explícitamente por Víctor.
- No borrar la cuenta ni regenerar invitaciones sin demostrar que la cuenta existente no es recuperable.
