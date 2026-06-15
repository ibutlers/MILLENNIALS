#!/usr/bin/env bash
# E2E Admin Setup: isolated environment, migrations, fixtures, no registration endpoint.
# Teardown guaranteed via trap. All resources cleaned on exit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
E2E_COMPOSE="$PROJECT_DIR/e2e/docker-compose.e2e.yml"
E2E_PROJECT="realstate-e2e"
CREDS_FILE="/tmp/e2e-admin-creds-$$.json"

cd "$PROJECT_DIR"

# ═══════════════════════════════════════
# TRAP: guaranteed teardown
# ═══════════════════════════════════════
cleanup() {
  echo ""
  echo "=== E2E TEARDOWN ==="
  
  # List resources before
  echo "Resources antes de teardown:"
  docker ps -a --filter "name=${E2E_PROJECT}" --format '  container: {{.Names}} ({{.Status}})' 2>/dev/null || true
  docker network ls --filter "name=${E2E_PROJECT}" --format '  network: {{.Name}}' 2>/dev/null || true
  docker volume ls --filter "name=${E2E_PROJECT}" --format '  volume: {{.Name}}' 2>/dev/null || true
  
  # Destroy
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
  
  # Verify cleanup
  local remaining_containers remaining_networks remaining_volumes
  remaining_containers=$(docker ps -a --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)
  remaining_networks=$(docker network ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)
  remaining_volumes=$(docker volume ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)
  
  if [ -z "$remaining_containers" ] && [ -z "$remaining_networks" ] && [ -z "$remaining_volumes" ]; then
    echo "✓ Todos los recursos E2E eliminados"
  else
    echo "⚠ Quedan recursos E2E: containers=${remaining_containers:-0} networks=${remaining_networks:-0} volumes=${remaining_volumes:-0}"
  fi
  
  # Remove creds file
  rm -f "$CREDS_FILE" 2>/dev/null || true
  echo "✓ Archivo de credenciales eliminado"
  
  echo "=== Teardown completado ==="
}
trap cleanup EXIT INT TERM

# ═══════════════════════════════════════
# ISOLATION CHECKS
# ═══════════════════════════════════════
echo "=== Verificaciones de aislamiento ==="
check() { echo "ERROR: $1 — ABORTANDO"; exit 1; }
grep -q 'current_postgres-data' "$E2E_COMPOSE" 2>/dev/null && check "volumen current_postgres-data en compose E2E"
grep -q 'shared/.env' "$E2E_COMPOSE" 2>/dev/null && check "shared/.env en compose E2E"
grep -qE '0\.0\.0\.0' "$E2E_COMPOSE" 2>/dev/null && check "binding 0.0.0.0 en compose E2E"
grep -q '8088' "$E2E_COMPOSE" 2>/dev/null && check "puerto 8088 en compose E2E"
echo "✓ Aislamiento verificado"

# ═══════════════════════════════════════
# START ENVIRONMENT
# ═══════════════════════════════════════
echo ""
echo "=== Arrancando entorno E2E ==="
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" build --quiet 2>&1 | tail -1
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" up -d --wait 2>&1 | tail -3

# Wait for API
echo "Esperando API..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8089/api/health 2>/dev/null | grep -q '"ok"'; then
    echo "API lista (${i}s)"
    break
  fi
  sleep 1
done

# ═══════════════════════════════════════
# MIGRATIONS + FIXTURES
# ═══════════════════════════════════════
echo ""
echo "=== Migraciones ==="
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/migrate.js 2>/dev/null || true
sleep 2

echo ""
echo "=== Creando usuarios E2E (CLI fixtures, sin registro) ==="
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/fixtures/create-e2e-users.js --credentials-file=/tmp/e2e-creds.json 2>&1 | grep -v "^$" || true

# Copy creds from container to host for Playwright
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" cp api:/tmp/e2e-creds.json "$CREDS_FILE" 2>/dev/null && chmod 600 "$CREDS_FILE" || true

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Entorno E2E listo                     ║"
echo "║  Frontend: http://127.0.0.1:8090       ║"
echo "║  API:      http://127.0.0.1:8089       ║"
echo "║  Creds:    $CREDS_FILE                 ║"
echo "║  Admin:    admin@e2e.realstate.test    ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "E2E_CREDS_FILE=$CREDS_FILE"
echo "E2E_API_URL=http://127.0.0.1:8089"
echo "E2E_WEB_URL=http://127.0.0.1:8090"
echo ""
echo "Ejecuta Playwright ahora. El teardown se ejecutará automáticamente al salir (trap)."

# Wait for signal or Playwright to finish
# The trap guarantees cleanup on exit
sleep infinity &
wait $!
