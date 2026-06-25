# Pendientes de Realstate

## Cerrado técnicamente

- [x] Better Auth/Admin base implementado, validado y desplegado.
- [x] MFA opcional por decisión de producto (`betterAuthRequire2FA=false`).
- [x] Recovery/reset real con Better Auth + SMTP/capture, anti-enumeración y tests.
- [x] Segundo admin real preparado técnicamente mediante flujo oficial de invitación; no ejecutado por falta de email real.
- [x] Documentos privados inversor sin exposición de `storage_ref`.
- [x] Roles `operator/staff/admin` cerrados: `operator` canónico, `staff` legacy normalizado.
- [x] Hardening HTTP/IP temporal documentado y verificado con `scripts/auth/check-temporary-http-ip.sh`.
- [x] QA gaps final / observabilidad básica cerrada con scripts ops read-only.
- [x] Runbooks operativos consolidados:
  - `docs/runbooks/production-operations.md`
  - `docs/runbooks/operations-checklist.md`
  - `docs/runbooks/qa-operational-checks.md`
  - `docs/runbooks/monitoring-recurring.md`
- [x] Informe ejecutivo de readiness creado en `docs/runbooks/production-readiness-executive-summary.md`.

## WAITING_HUMAN

- [ ] Proporcionar `ADMIN_EMAIL_2` para crear/invitar un segundo administrador real.

## EXTERNOS / NO BLOQUEANTES

- [ ] Dominio definitivo.
- [ ] HTTPS definitivo.
- [ ] Retirar `AUTH_ALLOW_INSECURE_IP_TEST` cuando haya dominio + HTTPS.
- [ ] Legal/cookies/política de privacidad definitivos.
- [ ] Cron/alertas recurrentes si se desea monitorización automática.
- [ ] Restore drill completo en entorno efímero con backup reciente.
- [ ] SMTP fail/retry real automatizado.

## Estado temporal aceptado

Producción mantiene temporalmente auth/admin/email activos sobre HTTP/IP por decisión de producto:

- `AUTH_MODE=better-auth`
- `AUTH_EMAIL_MODE=smtp`
- `ADMIN_ENABLED=true`
- `AUTH_ALLOW_INSECURE_IP_TEST=true` temporal
- `BETTER_AUTH_REQUIRE_2FA=false` opcional

Fecha objetivo de retirada de la ventana HTTP/IP temporal: **2026-07-08**.

## No hacer sin autorización explícita

- No editar `/srv/deployments/realstate/shared/.env` sin backup previo y autorización.
- No cambiar flags críticos.
- No desactivar auth/admin/SMTP sin plan de rollback.
- No activar 2FA obligatorio sin decisión explícita.
- No crear admins reales con datos ficticios.
- No tocar DNS/proxy sin autorización.
- No borrar datos.
- No borrar backups.
- No borrar ni recrear `current_postgres-data`.
- No borrar volúmenes `current_*`.
- No ejecutar `docker compose down -v`.
- No ejecutar `docker system prune -a`.
- No imprimir secretos, tokens, cookies ni enlaces privados.

## Runbooks principales

- `docs/runbooks/production-operations.md` — índice operativo final.
- `docs/runbooks/production-readiness-executive-summary.md` — resumen ejecutivo de readiness.
- `docs/runbooks/operations-checklist.md` — checklist diario/semanal/mensual.
- `docs/runbooks/monitoring-recurring.md` — plantilla cron/systemd no activada.
- `docs/runbooks/qa-operational-checks.md` — QA operacional y scripts read-only.
- `docs/runbooks/auth-temporal-http-ip.md` — ventana temporal HTTP/IP.
- `docs/runbooks/auth-production-activation.md` — activación futura con dominio/HTTPS.
- `docs/runbooks/auth-backup-recovery.md` — backups y recuperación.
- `docs/runbooks/auth-recovery-reset.md` — recuperación/restablecimiento de contraseña.
- `docs/runbooks/second-admin-setup.md` — segundo admin real.
- `docs/runbooks/roles-operator-staff-admin.md` — roles.
- `docs/runbooks/investor-private-documents.md` — documentos privados.
