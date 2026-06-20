# Recovery/reset de contraseña con Better Auth

Fecha: 2026-06-20

## Estado operativo

El flujo de recuperación usa Better Auth como autoridad única para tokens y cambio de contraseña:

- UI solicitud: `/acceso/recuperar`.
- API solicitud: `POST /api/auth/request-password-reset`.
- UI cambio: `/acceso/restablecer?token=...`.
- API cambio: `POST /api/auth/reset-password?token=...`.

Los endpoints legacy `/api/v1/auth/forgot-password` y `/api/v1/auth/reset-password` no son el camino operativo de Better Auth.

## Reglas de seguridad

- No imprimir tokens, enlaces completos, cookies ni cabeceras de sesión.
- La respuesta de solicitud de reset debe ser anti-enumeración: el usuario ve un mensaje genérico aunque el email no exista.
- El token solo debe viajar por email al titular de la cuenta.
- El cambio de contraseña debe rechazar la contraseña antigua después del reset.
- Las sesiones activas deben quedar revocadas o inutilizables tras completar el reset.
- No usar SQL manual para crear, leer o consumir tokens de reset.

## Procedimiento de smoke seguro

### Sin credenciales ni inbox

```bash
curl -i -X POST http://127.0.0.1:8088/api/auth/request-password-reset \
  -H 'Content-Type: application/json' \
  -d '{"email":"nonexistent-smoke@realstate.invalid","redirectTo":"/acceso/restablecer"}'
```

Resultado esperado:

- HTTP 200.
- Mensaje genérico.
- Ningún dato que revele si la cuenta existe.
- Ningún token en stdout/logs.

### E2E completo

El flujo completo se valida en `pnpm test:e2e:auth` con provider capturado:

1. Crear inversor efímero.
2. Activar email y MFA.
3. Abrir sesión.
4. Solicitar reset desde `/acceso/recuperar`.
5. Consumir el enlace de Better Auth desde el provider capturado.
6. Cambiar contraseña en `/acceso/restablecer`.
7. Confirmar que la contraseña antigua falla.
8. Confirmar que la nueva contraseña funciona.
9. Confirmar que la sesión previa queda revocada.

## Producción SMTP

Producción usa `AUTH_EMAIL_MODE=smtp`. Para una prueba de entrega real:

1. Solicitar reset desde navegador en `/acceso/recuperar`.
2. Introducir el email real localmente.
3. Revisar el inbox sin compartir el enlace.
4. Si se completa reset real, introducir nueva contraseña localmente.
5. No pegar tokens ni enlaces de reset en chats/logs/tickets.

No se debe ejecutar una prueba real de reset sobre un admin sin responsable humano disponible para recibir el email y completar/descartar el enlace.
