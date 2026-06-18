# Pendientes de Realstate

## Estado técnico ya completado

- [x] Better Auth implementado y desplegado en producción en modo seguro (`AUTH_MODE=disabled`).
- [x] Admin E2E migrado a Better Auth.
- [x] E2E auth validado.
- [x] E2E admin validado.
- [x] E2E público validado.
- [x] Migraciones de auth aplicadas y validadas en entorno de pruebas.
- [x] `test-database` validado con 13 migraciones.
- [x] Producción desplegada en modo seguro:
  - `AUTH_MODE=disabled`
  - `AUTH_EMAIL_MODE=disabled`
  - `ADMIN_ENABLED=false`
- [x] Procedimiento de backup/restore con tablas `auth.*` documentado en `docs/runbooks/auth-backup-recovery.md`.
- [x] Runbooks de activación futura documentados:
  - `docs/runbooks/auth-preflight-checklist.md`
  - `docs/runbooks/auth-production-activation.md`

## Pendientes externos antes de activar auth/admin real

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
- [ ] Activación explícita de `AUTH_MODE=better-auth`.
- [ ] Activación explícita de `AUTH_EMAIL_MODE=smtp`.
- [ ] Activación explícita de `ADMIN_ENABLED=true` solo cuando proceda.

## No hacer todavía

- [ ] No activar `AUTH_MODE=better-auth`.
- [ ] No activar `AUTH_EMAIL_MODE=smtp`.
- [ ] No activar `ADMIN_ENABLED=true`.
- [ ] No crear admins reales con datos ficticios.
- [ ] No enviar correos reales.
- [ ] No editar `/srv/deployments/realstate/shared/.env`.
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
