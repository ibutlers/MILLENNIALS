# Despliegue — Realstate

Estado detectado: Docker/Compose, Caddy y Nginx no estaban instalados inicialmente. Puertos ocupados: 22, 18789, 3000 local, 9119 local, 18791 local, DNS local 53.

Directorios:
- Workspace: `/srv/workspaces/realstate`.
- Deployments: `/srv/deployments/realstate`.
- Backups: `/srv/backups/realstate`.
- Logs: `/var/log/realstate`.

Estrategia: Docker Compose reproducible con Caddy en contenedor. Puerto por defecto `8088` para evitar interferir con servicios existentes. Con dominio/DNS, ajustar `CADDY_DOMAIN` y puertos.

Comandos:
```bash
./scripts/deploy.sh
./scripts/healthcheck.sh
./scripts/rollback.sh
```
