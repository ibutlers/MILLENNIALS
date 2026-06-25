# Runbook — Operación de producción

Índice práctico de operación para la release activa de Realstate.

## Estado actual aceptado

- Producción activa en HTTP/IP temporal.
- Better Auth activo.
- Admin activo.
- SMTP activo.
- MFA opcional: `betterAuthRequire2FA=false`.
- `AUTH_ALLOW_INSECURE_IP_TEST=true` es temporal y debe retirarse con dominio + HTTPS.
- `WAITING_HUMAN`: proporcionar `ADMIN_EMAIL_2`.

## Comando de salud en 5 minutos

En el servidor:

```bash
cd /srv/workspaces/realstate
scripts/ops/check-production.sh
```

Resultado sano:

```text
RESULT=ok
```

Si falla, no pegar logs completos en chats. Revisar conteos y seguir los runbooks enlazados.

## Estado Git/release

```bash
cd /srv/workspaces/realstate
git status --short --branch
echo "HEAD=$(git rev-parse HEAD)"
echo "ORIGIN=$(git rev-parse origin/main)"
echo "CURRENT=$(readlink -f /srv/deployments/realstate/current)"
echo "REVISION=$(cat /srv/deployments/realstate/current/REVISION)"
```

Sano: `HEAD = ORIGIN = REVISION` y repo limpio.

## Despliegue

Runbook: `docs/deployment.md`.

Comando único permitido:

```bash
cd /srv/workspaces/realstate
./scripts/deploy.sh
```

No usar despliegues manuales alternativos.

## Rollback

Runbook: `docs/runbooks/auth-production-activation.md` y `scripts/rollback.sh`.

```bash
cd /srv/workspaces/realstate
./scripts/rollback.sh
```

No ejecutar rollback salvo fallo real o autorización explícita.

## Health checks

```bash
curl -fsS http://127.0.0.1:8088/health
curl -fsS http://127.0.0.1:8088/api/health
curl -fsS http://127.0.0.1:8088/api/config/public
```

Esperado:

- `/health` -> `ok`.
- `/api/health` -> PostgreSQL `ok`.
- `/api/config/public` -> `authEnabled=true`, `betterAuthRequire2FA=false`.

## Auth temporal HTTP/IP

Runbook: `docs/runbooks/auth-temporal-http-ip.md`.

```bash
scripts/auth/check-temporary-http-ip.sh
scripts/ops/check-auth-posture.sh
```

No cambiar flags sin autorización.

## MFA opcional

Runbooks:

- `docs/runbooks/admin-mfa-flow.md`
- `docs/runbooks/auth-temporal-http-ip.md`

Estado actual: MFA no obligatorio. No activar `BETTER_AUTH_REQUIRE_2FA=true` sin decisión explícita.

## Recuperación de contraseña

Runbook: `docs/runbooks/auth-recovery-reset.md`.

Regla: nunca imprimir tokens ni enlaces completos de reset.

## Segundo admin real

Runbooks:

- `docs/runbooks/second-admin-setup.md`
- `docs/runbooks/second-admin-real.md`

Pendiente humano:

```text
WAITING_HUMAN: proporcionar ADMIN_EMAIL_2
```

No crear admins ficticios. No usar SQL manual para crear admin.

## Roles

Runbook: `docs/runbooks/roles-operator-staff-admin.md`.

Modelo:

- `admin`: administración completa.
- `operator`: operador canónico limitado.
- `investor`: inversor.
- `staff`: alias legacy normalizado a `operator`.

## Documentos privados inversor

Runbook: `docs/runbooks/investor-private-documents.md`.

Regla: APIs públicas/privadas no listan `storage_ref`; usan `download_available`.

## Backups

Runbook: `docs/runbooks/auth-backup-recovery.md`.

```bash
scripts/ops/check-backups.sh
```

No borrar backups. Antes de editar `.env`, crear backup específico de `.env` y pedir autorización.

## Logs

```bash
scripts/ops/check-logs.sh
```

El script muestra conteos sanitizados. No imprimir líneas completas si contienen secretos/cookies/tokens.

## Recursos E2E

```bash
scripts/ops/check-e2e-resources.sh
```

Sano:

```text
e2e_containers=0 e2e_volumes=0 e2e_networks=0
```

## Smoke producción

```bash
scripts/ops/smoke-production.sh
```

Comprueba health, config pública, auth sin cookie, contenedores, volumen y recursos E2E.

## Scripts ops disponibles

```text
scripts/ops/check-production.sh
scripts/ops/smoke-production.sh
scripts/ops/check-auth-posture.sh
scripts/ops/check-backups.sh
scripts/ops/check-e2e-resources.sh
scripts/ops/check-logs.sh
scripts/auth/check-temporary-http-ip.sh
```

## Qué no tocar en producción

- No editar `.env` sin autorización y backup previo.
- No cambiar flags críticos sin autorización.
- No tocar ni recrear `current_postgres-data`.
- No borrar datos ni backups.
- No ejecutar `docker compose down -v`.
- No ejecutar `docker system prune -a`.
- No imprimir secretos, tokens, cookies ni enlaces privados.
- No crear admins ficticios.
- No forzar MFA.

## Otros runbooks útiles

- `docs/runbooks/qa-operational-checks.md`
- `docs/runbooks/operations-checklist.md`
- `docs/runbooks/monitoring-recurring.md`
- `docs/runbooks/auth-incident.md`
- `docs/runbooks/auth-secret-rotation.md`
- `docs/runbooks/auth-email-setup.md`
