#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_COMPOSE="$ROOT_DIR/e2e/docker-compose.e2e.yml"
E2E_PROJECT="realstate-e2e"
ENV_FILE="/tmp/realstate-e2e-env-$$.env"
CREDS_FILE="/tmp/realstate-e2e-creds-$$.json"
PG_PASSWORD=""

cleanup() {
  local status=$?
  echo ""
  echo "=== E2E TEARDOWN ==="
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
  rm -f "$ENV_FILE" "$CREDS_FILE"
  echo "E2E resources cleaned (env file, creds file, compose project)"
  exit "$status"
}
trap cleanup EXIT INT TERM

echo "=== E2E Setup ==="

# ── Generate ephemeral strong password ──
PG_PASSWORD="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c24)"
echo "PG_PASSWORD=***" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "-> Ephemeral PostgreSQL password generated"

cd "$ROOT_DIR"

# ── Start Compose (clean state every time) ──
echo "-> Starting isolated E2E environment (fresh state)..."
# Always start fresh: remove any previous volume to guarantee password match
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
POSTGRES_PASSWORD=*** \
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" up -d --wait --build 2>&1 | grep -v '^$' || true

# ── Wait for PostgreSQL readiness ──
echo "-> Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T postgres pg_isready -U realstate_e2e -d realstate_e2e >/dev/null 2>&1; then
    echo "  PostgreSQL ready (${i}s)"
    break
  fi
  sleep 1
done

# ── Wait for API readiness ──
echo "-> Waiting for API..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8089/api/health 2>/dev/null | grep -q '"ok"'; then
    echo "  API ready (${i}s)"
    break
  fi
  sleep 1
done

if ! curl -s http://127.0.0.1:8089/api/health | grep -q '"ok"'; then
  echo "ERROR: API failed to start"
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" logs api 2>&1 | tail -30
  exit 1
fi

# ── Run migrations ──
echo "-> Running migrations..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/migrate.js 2>&1

# ── Run seed ──
echo "-> Running seed..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/seed.js 2>&1

# Verify seed data
echo "-> Verifying seed data..."
OPP_COUNT=$(curl -s http://127.0.0.1:8089/api/v1/opportunities | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "0")
echo "  Public opportunities available: ${OPP_COUNT}"

# ── Admin fixtures (only when requested) ──
if [[ "${E2E_ADMIN_FIXTURES:-}" == "true" ]]; then
  echo "-> Creating admin E2E fixtures..."
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/fixtures/create-e2e-users.js 2>&1 | grep -v '^$' || true
fi

# ── Frontend readiness ──
echo "-> Waiting for frontend..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8090 2>/dev/null | grep -q '200'; then
    echo "  Frontend ready (${i}s)"
    break
  fi
  sleep 1
done

echo ""
echo "E2E environment ready:"
echo "  Frontend: http://127.0.0.1:8090"
echo "  API:      http://127.0.0.1:8089"
echo ""

# ── Block until Playwright finishes or timeout ──
# Playwright terminates the webServer process when the suite exits; the EXIT/TERM
# trap above preserves the original status and removes Compose resources.
sleep infinity &
wait $!
