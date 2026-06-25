# Informe ejecutivo — readiness de producción

Fecha: **2026-06-25**.

## Resumen

Realstate está operativa en producción con Better Auth, panel admin, SMTP y observabilidad básica read-only. La plataforma está lista para operación controlada en la ventana temporal aceptada HTTP/IP, pero no es la postura definitiva hasta cerrar dominio + HTTPS y retirar `AUTH_ALLOW_INSECURE_IP_TEST`.

## Estado listo

- Better Auth/Admin base: cerrado y desplegado.
- MFA opcional: cerrado por decisión de producto (`betterAuthRequire2FA=false`).
- Recovery/reset real: cerrado.
- Segundo admin real: flujo técnico preparado, pendiente de email real.
- Documentos privados inversor: cerrados; no se expone `storage_ref`.
- Roles: `admin`, `operator`, `investor`; `staff` legacy normalizado a `operator`.
- Hardening HTTP/IP temporal: documentado y verificable.
- QA gaps final/observabilidad básica: cerrada.
- Runbooks operativos: cerrados.

## Estado temporal aceptado

La producción sigue temporalmente en HTTP/IP con:

- `AUTH_MODE=better-auth`
- `AUTH_EMAIL_MODE=smtp`
- `ADMIN_ENABLED=true`
- `AUTH_ALLOW_INSECURE_IP_TEST=true`
- `BETTER_AUTH_REQUIRE_2FA=false`

Fecha objetivo de retirada de la ventana temporal: **2026-07-08**.

## Evidencia operativa actual

Última release verificada:

- Release activa: `/srv/deployments/realstate/releases/20260625T113350Z`
- `REVISION`: `792e37024beebfca453681469db5689547240f99`
- `HEAD = origin/main = REVISION`

Checks verificados:

- `/health` -> `ok`
- `/api/health` -> PostgreSQL `ok`
- `/api/config/public` -> `authEnabled=true`, `betterAuthRequire2FA=false`
- `/acceso/login` -> 200
- `/admin` -> 200
- `/api/auth/me` sin cookie -> 401
- `/api/v1/admin/dashboard` sin cookie -> 401
- `current_postgres-data` intacto
- recursos E2E = 0
- `scripts/ops/check-production.sh` -> `RESULT=ok executed=6 omitted=0 failed=0`

## Dependencias humanas

- `ADMIN_EMAIL_2`: falta proporcionar email real para crear/invitar segundo admin.

No bloquea el resto de operación.

## Dependencias externas/no bloqueantes

- Dominio definitivo.
- HTTPS definitivo.
- Retirada de `AUTH_ALLOW_INSECURE_IP_TEST`.
- Legal/cookies/política de privacidad definitivos.
- Cron/alertas recurrentes si se desea.
- Restore drill completo en entorno efímero.
- SMTP fail/retry real automatizado.

## Riesgos aceptados

- Tráfico HTTP temporal sin HTTPS.
- Cookies sin `Secure` mientras se mantenga HTTP.
- Admin único real hasta recibir `ADMIN_EMAIL_2`.
- Monitorización recurrente no activada todavía; hay checks manuales read-only.

## Comando ejecutivo de salud

```bash
cd /srv/workspaces/realstate
scripts/ops/check-production.sh
```

Sano:

```text
RESULT=ok
```

## No hacer

- No editar `.env` sin autorización y backup previo.
- No cambiar flags críticos.
- No tocar `current_postgres-data`.
- No borrar datos ni backups.
- No ejecutar `docker compose down -v`.
- No ejecutar `docker system prune -a`.
- No imprimir secretos, tokens, cookies ni enlaces privados.
- No crear admins ficticios.
- No forzar MFA.

## Próximo paso humano recomendado

Proporcionar `ADMIN_EMAIL_2` o confirmar que no se crea segundo admin todavía.

## Próximo paso externo recomendado

Cerrar dominio + HTTPS y planificar retirada de `AUTH_ALLOW_INSECURE_IP_TEST`.
