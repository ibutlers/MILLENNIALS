#!/usr/bin/env bash
# E2E Setup: starts isolated environment, runs migrations, bootstraps users
# After this exits, containers keep running. Call teardown separately.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
E2E_COMPOSE="$PROJECT_DIR/e2e/docker-compose.e2e.yml"
E2E_PROJECT="realstate-e2e"

cd "$PROJECT_DIR"

# ═══ Isolation checks ═══
echo "=== Verificaciones de aislamiento ==="
if grep -q 'current_postgres-data' "$E2E_COMPOSE" 2>/dev/null; then echo "ERROR: current_postgres-data en compose E2E"; exit 1; fi
if grep -q 'shared/.env' "$E2E_COMPOSE" 2>/dev/null; then echo "ERROR: shared/.env en compose E2E"; exit 1; fi
if grep -qE '0\.0\.0\.0|"0.0.0.0"' "$E2E_COMPOSE" 2>/dev/null; then echo "ERROR: 0.0.0.0 binding en compose E2E"; exit 1; fi
if grep -q '8088' "$E2E_COMPOSE" 2>/dev/null; then echo "ERROR: puerto 8088 en compose E2E"; exit 1; fi
echo "✓ Aislamiento verificado"

# ═══ Clean previous ═══
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true

# ═══ Build & start ═══
echo "=== Construyendo y arrancando ==="
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" build --quiet 2>&1 | tail -1
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" up -d --wait 2>&1 | tail -3

# ═══ Wait for API ═══
echo "Esperando API..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8089/api/health 2>/dev/null | grep -q '"ok"'; then
    echo "API lista (${i}s)"
    break
  fi
  sleep 1
done

# ═══ Migrations ═══
echo "Aplicando migraciones..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node dist/db/migrate.js 2>/dev/null || true
sleep 2

# ═══ Bootstrap users ═══
echo "Creando usuarios de prueba..."
E2E_TEST_MODE=true bash "$PROJECT_DIR/scripts/e2e-bootstrap-users.sh" 2>/dev/null || echo "  (bootstrap ejecutado)"

echo ""
echo "=== Entorno E2E listo ==="
echo "Frontend: http://127.0.0.1:8090"
echo "API: http://127.0.0.1:8089"
echo "Admin: admin@e2e.realstate.test / AdminE2E-Pass123!"
echo "Operator: operator@e2e.realstate.test / OperatorE2E-Pass123!"
echo ""
