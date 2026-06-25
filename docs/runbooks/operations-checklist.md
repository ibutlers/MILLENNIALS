# Runbook — Checklist de operación

Checklist periódico para producción Realstate. Todos los comandos son read-only salvo que se indique lo contrario.

## Diario

Desde `/srv/workspaces/realstate`:

```bash
scripts/ops/check-production.sh
```

Si se necesita granularidad:

- [ ] Ejecutar smoke:

  ```bash
  scripts/ops/smoke-production.sh
  ```

- [ ] Verificar postura auth temporal:

  ```bash
  scripts/ops/check-auth-posture.sh
  ```

- [ ] Verificar recursos E2E residuales:

  ```bash
  scripts/ops/check-e2e-resources.sh
  ```

- [ ] Revisar logs sanitizados:

  ```bash
  scripts/ops/check-logs.sh
  ```

- [ ] Revisar health/API:

  ```bash
  curl -fsS http://127.0.0.1:8088/health
  curl -fsS http://127.0.0.1:8088/api/health
  ```

- [ ] Comprobar backups recientes:

  ```bash
  scripts/ops/check-backups.sh
  ```

## Semanal

- [ ] Revisar backups, tamaños y permisos:

  ```bash
  scripts/ops/check-backups.sh
  ```

- [ ] Revisar pendientes externos en `docs/PENDIENTES.md`.
- [ ] Revisar ventana temporal HTTP/IP en `docs/runbooks/auth-temporal-http-ip.md`.
- [ ] Confirmar si ya se puede retirar `AUTH_ALLOW_INSECURE_IP_TEST`.
- [ ] Confirmar si Víctor ya proporcionó `ADMIN_EMAIL_2`.
- [ ] Confirmar si dominio/HTTPS está listo.
- [ ] Revisar vulnerabilidades:

  ```bash
  pnpm audit --audit-level=low
  ```

## Mensual

- [ ] Ejecutar restore drill en entorno efímero con un backup reciente.
- [ ] Revisar roles y accesos:
  - `admin` completos;
  - `operator` limitados;
  - `investor` privados;
  - `staff` solo como legacy normalizado.
- [ ] Revisar usuarios, invitaciones y auditoría con scripts `scripts/auth/*` sin imprimir tokens.
- [ ] Revisar rotación/validación de credenciales si procede.
- [ ] Revisar releases antiguas con política segura.

## Limpieza de releases antiguas

No hay limpieza automática activada. Si se decide limpiar:

- pedir autorización explícita;
- conservar `current` y `previous`;
- confirmar `REVISION` activa;
- no tocar `/srv/deployments/realstate/shared`;
- no tocar `current_postgres-data`;
- no borrar backups;
- no usar `docker system prune -a`.

## Criterio rápido de producción sana

Producción se considera sana si:

- `scripts/ops/check-production.sh` termina con `RESULT=ok`;
- `HEAD = origin/main = REVISION`;
- `/health` devuelve `ok`;
- `/api/health` confirma PostgreSQL `ok`;
- `/api/config/public` devuelve `authEnabled=true`, `betterAuthRequire2FA=false`;
- contenedores `current-*` están up;
- `current_postgres-data` existe;
- recursos E2E = 0;
- backups recientes y permisos correctos;
- logs sanitizados sin `secret_leak`, críticos, SMTP/auth/DB repetidos.
