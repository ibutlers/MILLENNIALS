#!/usr/bin/env bash
set -Eeuo pipefail

SUITE="${1:-public}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_COMPOSE="$ROOT_DIR/e2e/docker-compose.e2e.yml"
E2E_PROJECT="realstate-e2e"
ENV_FILE="/tmp/realstate-e2e-env-$$.env"
PG_PASSWORD=***

cleanup() {
  local status=$?
  echo ""
  echo "=== E2E TEARDOWN (${SUITE}) ==="
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
  rm -f "$ENV_FILE"
  unset E2E_INTERNAL_SECRET

  local remaining_containers remaining_volumes remaining_networks
  remaining_containers="$(docker ps -a --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  remaining_volumes="$(docker volume ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  remaining_networks="$(docker network ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  if [[ -z "$remaining_containers" && -z "$remaining_volumes" && -z "$remaining_networks" ]]; then
    echo "E2E resources remaining: 0"
  else
    echo "WARNING: E2E resources remain: containers=${remaining_containers:-0} volumes=${remaining_volumes:-0} networks=${remaining_networks:-0}"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

case "$SUITE" in
  public)
    CONFIG="playwright.config.ts"
    ADMIN_FIXTURES=false
    ;;
  admin)
    CONFIG="playwright.admin.config.ts"
    ADMIN_FIXTURES=true
    ;;
  *)
    echo "Usage: $0 public|admin" >&2
    exit 2
    ;;
esac

cd "$ROOT_DIR"

echo "=== E2E SETUP (${SUITE}) ==="
# Hard isolation checks: never touch production identifiers/port.
grep -q 'current_postgres-data' "$E2E_COMPOSE" && { echo "ERROR: production volume in E2E compose" >&2; exit 1; }
grep -q 'shared/.env' "$E2E_COMPOSE" && { echo "ERROR: shared/.env in E2E compose" >&2; exit 1; }
grep -q '8088' "$E2E_COMPOSE" && { echo "ERROR: production port 8088 in E2E compose" >&2; exit 1; }
grep -q 'POSTGRES_HOST_AUTH_METHOD' "$E2E_COMPOSE" && { echo "ERROR: trust auth marker in E2E compose" >&2; exit 1; }

PG_PASSWORD="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c24)"
E2E_INTERNAL_SECRET="$(openssl rand -hex 32)"
export E2E_INTERNAL_SECRET
printf 'POSTGRES_PASSWORD=***' > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Generated ephemeral PostgreSQL credentials and E2E internal secret (redacted)."

# Fresh environment every run so SCRAM password and schema always match.
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
POSTGRES_PASSWORD=*** docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" up -d --wait --build

echo "Running migrations..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/migrate.js

echo "Running seed..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/seed.js

if [[ "$ADMIN_FIXTURES" == "true" ]]; then
  echo "Creating admin fixtures..."
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/fixtures/create-e2e-users.js
fi

echo "Waiting for proxy/frontend readiness..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8090/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
    echo "Ready (${i}s)."
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:8090/health >/dev/null
curl -fsS http://127.0.0.1:8090/api/health >/dev/null

echo "Running Playwright (${SUITE})..."
pnpm --filter @realstate/web exec playwright test --config "$CONFIG" --project=chromium --workers=1 --retries=0 --reporter=line
