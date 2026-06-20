# Alta del segundo administrador real

Fecha: 2026-06-20

## Estado

Pendiente `ADMIN_EMAIL_2`: no hay segundo administrador real confirmado.

No crear administradores ficticios. No reutilizar emails de prueba. No revocar ni degradar el admin inicial hasta tener al menos dos admins reales activos y con procedimiento de recuperación documentado. MFA real es recomendable, pero no bloquea la operativa mientras `BETTER_AUTH_REQUIRE_2FA=false`.

## Por qué es obligatorio

Antes de exigir MFA globalmente (`BETTER_AUTH_REQUIRE_2FA=true`) o hacer cambios operativos sensibles, producción debe tener:

- admin inicial activo;
- segundo admin real activo;
- ambos con email verificado;
- ambos con MFA real completado si se decide activar MFA obligatorio;
- procedimiento de recuperación probado/documentado.

Esto evita bloqueo total del panel si un admin pierde contraseña, TOTP o backup codes.

## Procedimiento cuando Víctor proporcione email real

Entrada humana requerida:

- email real del segundo admin (`ADMIN_EMAIL_2`);
- nombre visible opcional.

Procedimiento técnico:

1. Verificar que no existe ya `app_users.email_normalized = ADMIN_EMAIL_2`.
2. Verificar que no hay invitación activa pendiente para ese email.
3. Crear una única invitación admin real con el flujo oficial.
4. Enviar email SMTP real con `/acceso/activar#token=...`.
5. No imprimir token ni enlace completo.
6. El humano completa:
   - activación;
   - contraseña local;
   - verificación email;
   - opcional: MFA real en `/acceso/2fa?retorno=/admin`;
   - si activa MFA: guardado de backup codes.
7. Verificar sin secretos:
   - `role=admin`;
   - `status=active`;
   - email verified true;
   - si no activa MFA: `auth.user."twoFactorEnabled"=false` y `app_users.mfa_enabled_at` puede ser `NULL`;
   - si activa MFA: `auth.user."twoFactorEnabled"=true`, `auth."twoFactor".verified=true` y `app_users.mfa_enabled_at` no nulo;
   - al menos una sesión activa reciente.
8. Ejecutar smoke admin sin imprimir cookies.

## No hacer

- No crear admin ficticio.
- No crear múltiples invitaciones activas para el mismo email.
- No forzar estado por SQL.
- No marcar MFA como completado manualmente.
- No activar `BETTER_AUTH_REQUIRE_2FA=true` si el segundo admin todavía no está listo.
