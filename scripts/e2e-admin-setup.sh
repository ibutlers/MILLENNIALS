#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Verificaciones de seguridad del entorno E2E ==="
cd "$PROJECT_DIR"

# Check 1: no production volume mounted
if docker volume ls --format '{{.Name}}' | grep -q 'current_postgres-data'; then
  echo "ERROR: Se detectó el volumen de producción 'current_postgres-data'. Abortando."
  exit 1
fi

# Check 2: no production containers running under 'current' project
if docker compose -f /srv/deployments/realstate/current/docker-compose.yml ps --format '{{.Names}}' 2>/dev/null | grep -q 'current-'; then
  echo "AVISO: Hay contenedores de producción corriendo. El entorno E2E es independiente — continuando."
fi

# Check 3: no 0.0.0.0 binding in E2E compose
if grep -q '0\.0\.0\.0' e2e/docker-compose.e2e.yml; then
  echo "ERROR: El compose E2E expone puertos en 0.0.0.0. Corrige a 127.0.0.1."
  exit 1
fi

# Check 4: not using production env file
if grep -q 'shared/.env' e2e/docker-compose.e2e.yml 2>/dev/null; then
  echo "ERROR: El compose E2E referencia shared/.env. No debe usar configuración de producción."
  exit 1
fi

echo "=== Controles de seguridad superados ==="

echo "=== Arrancando entorno E2E aislado ==="

# Build images
docker compose -f e2e/docker-compose.e2e.yml build --quiet

# Start services
docker compose -f e2e/docker-compose.e2e.yml up -d --wait

echo "Esperando a que la API esté lista..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8089/api/health | grep -q '"ok"'; then
    echo "API lista después de ${i}s"
    break
  fi
  sleep 1
done

# Run migrations
echo "Ejecutando migraciones..."
docker compose -f e2e/docker-compose.e2e.yml exec -T api node dist/db/migrate.js || true

# Wait for seed
sleep 2

echo "Entorno E2E listo en http://127.0.0.1:8090 (frontend) y http://127.0.0.1:8089 (API)"
echo "Para destruir: pnpm test:e2e:admin:teardown"
