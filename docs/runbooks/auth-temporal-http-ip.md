# Postura temporal de autenticación sobre HTTP/IP

Fecha de decisión operativa: 2026-06-20.

## Decisión vigente

Se mantiene temporalmente la activación de Better Auth/Admin sobre la URL HTTP/IP de producción mientras se completa el dominio + HTTPS.

Esta postura **no es el estado objetivo**. El estado objetivo sigue siendo dominio propio con HTTPS y cookies seguras.

## Alcance permitido

La excepción temporal solo es válida si se cumplen todas las condiciones:

- `APP_BASE_URL` apunta exactamente al host HTTP/IP autorizado para la activación temporal.
- `AUTH_MODE` permanece en modo Better Auth activo.
- `AUTH_EMAIL_MODE` permanece en modo SMTP real.
- `ADMIN_ENABLED=true`.
- `AUTH_ALLOW_INSECURE_IP_TEST=true` está presente únicamente para esta ventana temporal.
- No se exponen secretos, cookies, hashes, tokens ni enlaces de verificación en logs, tickets o conversaciones.

## Riesgos aceptados temporalmente

- Transporte HTTP sin cifrado extremo a extremo hasta disponer de HTTPS.
- Cookies sin garantías equivalentes a la configuración final HTTPS.
- Mayor sensibilidad operativa en pruebas manuales de acceso real.
- Necesidad de retirar explícitamente el override temporal al activar dominio/HTTPS.

## Controles compensatorios

- Mantener la excepción limitada al host exacto; no convertirla en bypass genérico.
- No cambiar flags críticos sin autorización explícita:
  - `AUTH_MODE`
  - `AUTH_EMAIL_MODE`
  - `ADMIN_ENABLED`
  - `AUTH_ALLOW_INSECURE_IP_TEST`
- No imprimir ni almacenar tokens de invitación, verificación, reset, cookies o secretos.
- Smoke posterior a cada deploy:
  - `/health`
  - `/api/health`
  - `/acceso/login`
  - `/api/auth/get-session`
  - `/api/v1/admin/dashboard` sin cookie debe responder 401, no 5xx.
  - `current_postgres-data` existe.
  - recursos E2E restantes = 0.
- Backups antes de cualquier cambio de configuración o despliegue que ejecute migraciones.
- Revisión periódica de logs sin exponer datos sensibles.

## Caducidad

Esta excepción debe retirarse cuando esté listo el frente definitivo con dominio + HTTPS.

El criterio de retirada es:

1. DNS apunta al proxy definitivo.
2. HTTPS válido operativo.
3. `APP_BASE_URL` usa `https://`.
4. Cookies seguras activadas.
5. `AUTH_ALLOW_INSECURE_IP_TEST` eliminado o establecido a `false`.
6. Smoke auth/admin pasa sobre la URL HTTPS.

## Rollback seguro

Rollback requiere autorización humana explícita porque cambia la postura de producción.

Pasos de rollback, después de autorización y backup:

1. Crear backup de `/srv/deployments/realstate/shared/.env` y PostgreSQL.
2. Desactivar la excepción temporal o volver al modo auth seguro acordado.
3. Desplegar con `./scripts/deploy.sh`.
4. Verificar `/health`, `/api/health`, `/acceso/login`, endpoints auth/admin y logs.
5. Confirmar que no se perdió `current_postgres-data`.

## Estado actual verificado

- Producción mantiene Better Auth/Admin activo.
- La cuenta admin real está enlazada entre `auth.user` y `app_users`.
- La invitación `INV-20260618-F00B23` está aceptada.
- La cuenta tiene `role=admin`, `status=active` y email verificado.
- En la postura temporal actual, MFA no está requerido por flag de producción; no se fuerza ni se simula MFA por SQL.
