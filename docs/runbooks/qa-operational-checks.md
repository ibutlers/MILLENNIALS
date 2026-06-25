# Runbook — QA operacional y observabilidad básica

Fecha de creación: **2026-06-25**.
Estado: **operativo read-only**.

## Objetivo

Centralizar los checks finales de calidad operativa de Realstate sin depender de secretos, `ADMIN_EMAIL_2`, dominio/HTTPS definitivo ni MFA obligatorio.

Este runbook cubre:

- inventario QA actual;
- huecos no críticos;
- smoke producción;
- postura auth temporal HTTP/IP;
- backups;
- recursos E2E residuales;
- logs recientes sin imprimir líneas sensibles.

## Restricciones permanentes

No ejecutar estos checks modificando estado:

- No editar `/srv/deployments/realstate/shared/.env`.
- No cambiar `AUTH_MODE`, `AUTH_EMAIL_MODE`, `ADMIN_ENABLED`, `AUTH_ALLOW_INSECURE_IP_TEST` ni `BETTER_AUTH_REQUIRE_2FA`.
- No tocar `current_postgres-data`.
- No borrar datos, backups, contenedores, volúmenes ni redes.
- No ejecutar `docker compose down -v`.
- No ejecutar `docker system prune -a`.
- No imprimir secretos, tokens, cookies, enlaces privados, SMTP password ni Better Auth secret.

## Inventario QA actual

Estado reciente aceptado por producto antes de este runbook:

| Área | Cobertura |
| --- | --- |
| `pnpm test` | Validado en tarjetas auth/recovery/docs/roles recientes. |
| `pnpm build` | Validado en tarjetas runtime recientes. |
| `pnpm test:e2e:auth` | 49 escenarios: invitación, activación, MFA opcional/obligatorio, reset, sesiones, IDOR, limpieza. |
| `pnpm test:e2e:admin` | 59 escenarios tras cierre de roles: admin/operator, invitaciones, dashboard, leads, oportunidades, restricciones. |
| `pnpm test:e2e:investor` | 34 escenarios: login, área privada, documentos, permisos y logout. |
| `pnpm test:e2e` público | Cobertura de landing, formularios públicos, rutas futuras privadas y contratos públicos. Ejecutar cuando haya cambios UI pública/navegación. |
| `./scripts/test-database.sh` | Canonical DB test para migraciones/seed/checksums; ejecutar si cambia DB/migraciones. |
| `pnpm audit --audit-level=low` | Ejecutar en barridos de seguridad o cambios de dependencias. |
| scripts auth | `bash -n scripts/*.sh scripts/auth/*.sh scripts/ops/*.sh` obligatorio tras cambios de scripts. |
| smoke producción | `scripts/ops/smoke-production.sh`. |
| postura HTTP/IP temporal | `scripts/auth/check-temporary-http-ip.sh` y `scripts/ops/check-auth-posture.sh`. |

## Scripts operativos read-only

Ejecutar desde el servidor en `/srv/workspaces/realstate` o desde la release activa si ya fue desplegada.

### Smoke producción

```bash
scripts/ops/smoke-production.sh
```

Comprueba:

- `/health`;
- `/api/health`;
- `/api/config/public`;
- `/acceso/login`;
- `/admin`;
- `/api/auth/get-session` sin cookie -> `200 null`;
- `/api/auth/me` sin cookie -> `401`;
- `/api/v1/admin/dashboard` sin cookie -> `401`;
- contenedores `current-*`;
- volumen `current_postgres-data`;
- recursos E2E residuales = 0.

### Postura auth temporal

```bash
scripts/ops/check-auth-posture.sh
```

Comprueba:

- `authEnabled=true`;
- `betterAuthRequire2FA=false`;
- endpoints E2E 404;
- APIs sin cookie 401;
- delega en `scripts/auth/check-temporary-http-ip.sh` si está disponible.

### Backups

```bash
scripts/ops/check-backups.sh
```

Comprueba solo metadatos:

- directorio `/srv/backups/realstate`;
- mínimo de backups DB;
- backup DB reciente;
- backup `.env` presente;
- tamaños mayores que 0;
- permisos no world/group-readable;
- `pg_restore --list` sobre el último dump DB si `pg_restore` está disponible.

No imprime contenido de `.env` ni valores de backups.

### Recursos E2E residuales

```bash
scripts/ops/check-e2e-resources.sh
```

Debe terminar con:

```text
RESULT=ok failures=0
```

si no quedan contenedores, volúmenes ni redes `realstate-e2e`/`e2e-auth`.

### Logs API recientes

```bash
scripts/ops/check-logs.sh
```

Comprueba conteos, no líneas completas:

- errores críticos;
- posibles secretos/tokens/cookies;
- stack traces;
- fallos SMTP;
- fallos auth;
- fallos DB.

Si detecta patrones de secretos/tokens/cookies debe considerarse P0/P1 operacional: no pegar logs completos; revisar en el servidor y rotar si procede.

## Comando agrupado recomendado

```bash
set -euo pipefail
scripts/ops/smoke-production.sh
scripts/ops/check-auth-posture.sh
scripts/ops/check-backups.sh
scripts/ops/check-e2e-resources.sh
scripts/ops/check-logs.sh
```

## Gaps QA detectados

Cubiertos o con cobertura suficiente reciente:

- recovery/reset real con anti-enumeración, token inválido/caducado y sesiones;
- documentos privados sin exposición de `storage_ref`;
- invitaciones con token y no exposición en APIs listables;
- roles `operator/admin` y restricciones de operator;
- admin sin MFA en modo opcional;
- admin sin MFA bloqueado en modo obligatorio;
- formularios públicos;
- rutas 401/403/404 principales;
- endpoints E2E 404 mediante script de postura temporal.

Huecos no críticos que no bloquean esta tarjeta:

1. **Restore drill periódico de backups**: existe runbook y validación `pg_restore --list`, pero falta simulacro completo de restore en entorno efímero con backup reciente.
2. **SMTP fail/retry end-to-end real**: hay cobertura con provider capture y smokes SMTP sin imprimir tokens, pero no hay prueba automatizada de proveedor SMTP real fallando/reintentando en producción.
3. **Rollback auth disabled E2E dedicado**: hay rollback documentado y script de rollback, pero no hay suite E2E dedicada que active/desactive flags en entorno efímero.
4. **Errores humanos de activación**: cubierto parcialmente por invitaciones expiradas/revocadas/reusadas; falta matriz UX completa de errores humanos reales.
5. **Monitorización continua**: los scripts son manuales/read-only; falta cron/alerta formal si Víctor quiere notificaciones recurrentes.

Estos huecos quedan documentados como deuda operativa, no como bloqueos. No dependen de `ADMIN_EMAIL_2`, dominio/HTTPS ni MFA obligatorio.

## Backups — criterio operativo

Healthy mínimo:

- último dump DB menor de 48h o creado por el último deploy;
- mínimo 3 dumps DB preservados;
- al menos 1 backup `.env` preservado;
- permisos `0600` en dumps y backups `.env` sensibles;
- último dump legible con `pg_restore --list`.

Antes de tocar `.env` debe crearse un nuevo backup `.env` aunque el check previo sea verde.

## Logs — criterio operativo

Healthy mínimo:

- `secret_leak=0`;
- `critical=0`;
- sin fallos SMTP/auth/DB repetidos;
- sin stack traces repetidos.

El script no imprime líneas completas. Si hay hallazgos, revisar localmente en servidor sin copiar secretos al chat.

## Cuándo ejecutar suites completas

Ejecutar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y E2E afectados si se toca runtime.

Para cambios solo docs/scripts read-only:

```bash
git diff --check
bash -n scripts/*.sh scripts/auth/*.sh scripts/ops/*.sh
```

Ejecutar E2E solo si el script/doc cambia comportamiento runtime, rutas, auth/admin/inversor, DB o navegación.
