# Pendientes de Realstate

## Estado técnico ya completado

- [x] Better Auth implementado y desplegado en producción (ventana temporal controlada con auth/admin activos).
- [x] Admin E2E migrado a Better Auth.
- [x] E2E auth validado.
- [x] E2E admin validado.
- [x] E2E público validado.
- [x] 20 migraciones versionadas (0001–0020) en el repositorio.
- [x] Producción en ventana temporal controlada (HTTP/IP, sin dominio/HTTPS definitivo):
  - Better Auth activo
  - SMTP activo
  - Admin activo
  - 2FA no obligatorio (betterAuthRequire2FA=false)
  - 1 admin real activo
- [x] Procedimiento de backup/restore con tablas `auth.*` documentado en `docs/runbooks/auth-backup-recovery.md`.
- [x] Modelo canónico de roles documentado: `operator` sustituye a `staff`, que queda como alias legacy normalizado.
- [x] Runbooks de activación futura documentados:
  - `docs/runbooks/auth-preflight-checklist.md`
  - `docs/runbooks/auth-production-activation.md`
  - `docs/runbooks/auth-temporal-http-ip.md`
- [x] QA operacional y observabilidad básica read-only documentadas en `docs/runbooks/qa-operational-checks.md`.

## Aceptación formal de riesgo — ventana temporal auth/admin sobre HTTP/IP

**Decisión**: Mantener la ventana temporal con auth/admin/email activos sobre IP/HTTP.
**Fecha de la decisión**: 2026-06-19 (hilo Kanban t_1245c893, comentario de desbloqueo de Víctor).

### Riesgo aceptado

Autenticación Better Auth, envío de correo transaccional (SMTP) y panel administrativo accesibles desde http://65.108.251.196:8088 sin HTTPS, dominio real ni 2FA obligatorio. Tráfico entre cliente y servidor viaja en texto plano. Las cookies de sesión no tienen flag Secure.

### Responsable

Víctor Pérez (fundador). Cualquier cambio en esta postura requiere su autorización explícita.

### Caducidad

⚠️ **Fecha objetivo de retirada: 2026-07-08.** Si la ventana temporal sigue activa después de esa fecha, tratarlo como alerta operativa P1: priorizar dominio + HTTPS o volver a modo seguro con autorización explícita. La condición objetiva de cierre sigue siendo migrar a HTTPS definitivo y desactivar `AUTH_ALLOW_INSECURE_IP_TEST`.

### Controles compensatorios activos

1. **Backups**: DB y .env respaldados antes de cada cambio de configuración. Último backup pre-rollback en `/srv/backups/realstate/database-pre-auth-rollback-20260619T190440Z.dump` (136 KB) y `shared-env-pre-auth-rollback-20260619T190440Z.env` (1010 B).
2. **Rollback listo**: `./scripts/rollback.sh` operativo y con sintaxis validada. Plan de rollback documentado con backup previo y 4 cambios de flags.
3. **Rate limiting**: Endpoints de auth y formularios con rate limiting activo en API.
4. **Startup enforcement**: `rejectInsecureAuth()` bloquea arranque si faltan variables requeridas o hay bypass no autorizados.
5. **Endpoints E2E no expuestos**: `/api/e2e/auth/*` devuelven 404 en producción, verificado por `scripts/auth/check-temporary-http-ip.sh`.
6. **Sin datos reales de inversores**: Solo 2 app_users (1 admin activo + 1 inversor de prueba). No hay capital, documentos ni KYC reales expuestos.
7. **Admin único controlado**: 1 solo admin activo; MFA permanece opcional por decisión de producto y el segundo admin real queda como `WAITING_HUMAN: proporcionar ADMIN_EMAIL_2`.
8. **Cookies/headers sin exposición en smoke**: El check operativo cuenta `Set-Cookie`, `HttpOnly`, `SameSite` y `Secure` sin imprimir valores. En HTTP temporal `Secure=false` es una deuda explícita hasta HTTPS.
9. **Monitorización básica**: Healthchecks `/health` y `/api/health` activos. Backups y logs accesibles para diagnóstico.
10. **Smoke automatizado read-only**: `scripts/auth/check-temporary-http-ip.sh` valida postura temporal sin tocar `.env`, DB, contenedores, volúmenes ni flags.

### Condiciones para cerrar esta ventana

La ventana temporal se considerará cerrada cuando se cumplan **todos** los requisitos de activación definitiva listados en este documento (dominio, HTTPS, SMTP definitivo, SPF/DKIM/DMARC, legal completo, dos admins reales, E2E verdes). MFA permanece opcional por decisión de producto; activar MFA obligatorio requerirá decisión futura explícita. En ese momento `AUTH_ALLOW_INSECURE_IP_TEST` pasará a `false`.

## Pendientes externos antes de activación definitiva

- [ ] Dominio definitivo.
- [ ] HTTPS válido para el dominio definitivo.
- [ ] SMTP real.
- [ ] SPF configurado.
- [ ] DKIM configurado.
- [ ] DMARC configurado.
- [ ] Datos legales completos:
  - [ ] Razón social.
  - [ ] NIF/CIF.
  - [ ] Domicilio.
  - [ ] Correo de contacto.
  - [ ] Datos registrales, si aplican.
- [ ] Aviso legal definitivo.
- [ ] Política de privacidad definitiva.
- [ ] Política de cookies definitiva.
- [ ] Revisión legal de textos de consentimiento.
- [ ] Procedimiento humano de brecha/incidencia.
- [ ] Dos cuentas admin reales.
- [ ] Procedimiento de recuperación si un admin pierde MFA.
- [ ] Prueba final con dominio real.
- [ ] Prueba final con SMTP real.
- [ ] Prueba final con MFA real.

## No hacer sin plan explícito

- [ ] No desactivar auth/admin/SMTP sin plan de rollback a modo seguro.
- [ ] No activar 2FA obligatorio sin segundo admin real y procedimiento de recuperación.
- [ ] No crear admins reales con datos ficticios.
- [ ] No enviar correos reales sin SPF/DKIM/DMARC.
- [ ] No editar `/srv/deployments/realstate/shared/.env` sin backup previo.
- [ ] No tocar DNS.
- [ ] No cambiar Caddy/proxy.
- [ ] No borrar datos.
- [ ] No borrar backups.
- [ ] No borrar ni recrear `current_postgres-data`.
- [ ] No borrar volúmenes `current_*`.
- [ ] No ejecutar `docker compose down -v`.
- [ ] No ejecutar `docker system prune -a`.

## Runbooks relacionados

- `docs/runbooks/auth-preflight-checklist.md` — checklist previo completo.
- `docs/runbooks/auth-production-activation.md` — procedimiento futuro de activación, creación de admins, smoke y rollback.
- `docs/runbooks/auth-backup-recovery.md` — backup y recuperación.
- `docs/runbooks/auth-incident.md` — respuesta a incidencias.
- `docs/runbooks/auth-secret-rotation.md` — rotación de secretos.
- `docs/runbooks/auth-email-setup.md` — configuración de correo.
- `docs/runbooks/second-admin-setup.md` — flujo seguro para invitar y activar un segundo admin real.
- `docs/runbooks/qa-operational-checks.md` — QA operacional, health/logs/backups y scripts read-only.
- `docs/runbooks/roles-operator-staff-admin.md` — modelo canónico de roles y compatibilidad legacy `staff`.
