# Runbook — Monitorización recurrente

Plantilla para convertir los checks read-only en monitorización recurrente. **No está activada**.

No crear cron, systemd timers ni alertas sin autorización explícita de Víctor.

## Ejecución manual

```bash
cd /srv/workspaces/realstate
scripts/ops/check-production.sh
```

Sano:

```text
RESULT=ok
```

Fallo:

```text
RESULT=fail
```

No pegar logs completos en chats; usar el resumen sanitizado.

## Directorio recomendado para logs

Si se activa monitorización recurrente más adelante:

```text
/var/log/realstate/ops-checks/
```

Los ficheros deben tener permisos restrictivos (`0600` o directorio `0700`) y no incluir secretos.

## Ejemplo de cron, no activar sin autorización

```cron
*/15 * * * * cd /srv/workspaces/realstate && scripts/ops/check-production.sh >> /var/log/realstate/ops-checks/check-production.log 2>&1
```

Antes de activarlo:

1. Confirmar ruta de logs.
2. Confirmar rotación de logs.
3. Confirmar destino de alertas.
4. Confirmar que el usuario del cron tiene solo permisos necesarios.
5. Ejecutar una prueba manual.

## Ejemplo de systemd service, no instalar sin autorización

`/etc/systemd/system/realstate-ops-check.service`:

```ini
[Unit]
Description=Realstate production read-only checks

[Service]
Type=oneshot
WorkingDirectory=/srv/workspaces/realstate
ExecStart=/srv/workspaces/realstate/scripts/ops/check-production.sh
StandardOutput=append:/var/log/realstate/ops-checks/check-production.log
StandardError=append:/var/log/realstate/ops-checks/check-production.log
```

## Ejemplo de systemd timer, no instalar sin autorización

`/etc/systemd/system/realstate-ops-check.timer`:

```ini
[Unit]
Description=Run Realstate production checks every 15 minutes

[Timer]
OnBootSec=5m
OnUnitActiveSec=15m
Unit=realstate-ops-check.service

[Install]
WantedBy=timers.target
```

## Alertas futuras

Opciones futuras, requieren autorización/configuración externa:

- Email SMTP operativo.
- Slack webhook o integración del gateway.
- Cron que envíe solo el resumen final (`RESULT=ok`/`RESULT=fail`) y conteos, nunca logs completos.

Ejemplo conceptual seguro:

```bash
if ! scripts/ops/check-production.sh > /tmp/realstate-check.log 2>&1; then
  tail -n 40 /tmp/realstate-check.log | sed -E 's/(token|secret|password|cookie)=([^[:space:]]+)/\1=[REDACTED]/gi'
fi
```

Antes de usarlo, reemplazar `/tmp` por ruta segura y revisar que no se imprimen secretos.

## Cómo evitar imprimir secretos

- No usar `set -x`.
- No imprimir `.env`.
- No usar `curl -i` contra endpoints que puedan devolver `Set-Cookie`.
- No enviar logs completos a Slack/email.
- Usar los scripts existentes, que imprimen conteos y estados sanitizados.
- Si se detecta `secret_leak>0`, revisar en servidor y rotar credenciales si procede.

## Criterio de activación futura

Solo activar monitorización recurrente cuando estén definidos:

- periodicidad;
- responsable de recibir alertas;
- destino de alertas;
- retención/rotación de logs;
- política de escalado;
- autorización explícita de Víctor.
