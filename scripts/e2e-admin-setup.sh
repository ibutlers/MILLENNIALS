#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Arrancando entorno E2E aislado ==="
cd "$PROJECT_DIR"

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
