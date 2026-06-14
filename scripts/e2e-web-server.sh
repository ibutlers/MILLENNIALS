#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="realstate-e2e-postgres"
DB_PORT="${REALSTATE_E2E_POSTGRES_PORT:-55433}"

cleanup() {
  local status=$?
  jobs -pr | xargs -r kill 2>/dev/null || true
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT INT TERM

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run --rm -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER=realstate \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=realstate_test \
  -p "127.0.0.1:${DB_PORT}:5432" \
  postgres:16-alpine >/dev/null

for _ in {1..60}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U realstate -d realstate_test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$CONTAINER_NAME" pg_isready -U realstate -d realstate_test >/dev/null

(
  cd "$ROOT_DIR"
  pnpm --filter @realstate/api build >/dev/null
  DB_URL="postgresql://realstate@127.0.0.1:${DB_PORT}/realstate_test"
  DATABASE_URL="$DB_URL" node apps/api/dist/db/migrate.js >/dev/null
  DATABASE_URL="$DB_URL" node apps/api/dist/db/seed.js >/dev/null
  DATABASE_URL="$DB_URL" API_PORT=3001 pnpm --filter @realstate/api dev >/tmp/realstate-e2e-api.log 2>&1 &
  pnpm --filter @realstate/web dev
)
