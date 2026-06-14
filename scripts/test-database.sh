#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="realstate-test-postgres"
DB_PORT="${REALSTATE_TEST_POSTGRES_PORT:-55432}"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cleanup

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

cd "$ROOT_DIR"
pnpm --filter @realstate/api build >/dev/null
DB_URL="postgresql://realstate@127.0.0.1:${DB_PORT}/realstate_test"
DATABASE_URL="$DB_URL" node apps/api/dist/db/migrate.js
DATABASE_URL="$DB_URL" node apps/api/dist/db/seed.js
DATABASE_URL="$DB_URL" node apps/api/dist/db/seed.js

count="$(docker exec "$CONTAINER_NAME" psql -U realstate -d realstate_test -tAc "SELECT count(*) FROM opportunities")"
public_count="$(docker exec "$CONTAINER_NAME" psql -U realstate -d realstate_test -tAc "SELECT count(*) FROM opportunities WHERE visibility='public'")"
private_count="$(docker exec "$CONTAINER_NAME" psql -U realstate -d realstate_test -tAc "SELECT count(*) FROM opportunities WHERE visibility='private'")"
migrations="$(docker exec "$CONTAINER_NAME" psql -U realstate -d realstate_test -tAc "SELECT count(*) FROM schema_migrations")"
relations="$(docker exec "$CONTAINER_NAME" psql -U realstate -d realstate_test -tAc "SELECT count(*) FROM opportunity_media m JOIN opportunities o ON o.id=m.opportunity_id")"

printf 'database_test count=%s public=%s private=%s migrations=%s media_relations=%s\n' "$count" "$public_count" "$private_count" "$migrations" "$relations"

[[ "$count" == "5" ]]
[[ "$public_count" == "4" ]]
[[ "$private_count" == "1" ]]
[[ "$migrations" == "1" ]]
[[ "$relations" == "5" ]]
