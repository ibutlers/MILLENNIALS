#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_COMPOSE="$ROOT_DIR/e2e/docker-compose.e2e-auth.yml"
E2E_PROJECT="realstate-e2e-auth"
ENV_FILE="/tmp/realstate-e2e-auth-env-$$.env"

cleanup() {
  local status=$?
  echo ""
  echo "=== E2E AUTH TEARDOWN ==="
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans 2>/dev/null || true
  rm -f "$ENV_FILE"
  unset E2E_INTERNAL_SECRET
  local rc rv rn
  rc="$(docker ps -a --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  rv="$(docker volume ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  rn="$(docker network ls --filter "name=${E2E_PROJECT}" -q 2>/dev/null || true)"
  if [[ -z "$rc" && -z "$rv" && -z "$rn" ]]; then
    echo "Recursos E2E Auth restantes: 0"
  else
    echo "WARNING: Recursos E2E Auth restantes: containers=${rc:-0} volumes=${rv:-0} networks=${rn:-0}"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

echo "=== E2E AUTH SETUP ==="

# Isolation validation
grep -q 'current_postgres-data' "$E2E_COMPOSE" && { echo "ERROR: volumen de produccion en compose E2E" >&2; exit 1; }
grep -q 'shared/.env' "$E2E_COMPOSE" && { echo "ERROR: shared/.env en compose E2E" >&2; exit 1; }
grep -q '8088' "$E2E_COMPOSE" && { echo "ERROR: puerto de produccion 8088 en compose E2E" >&2; exit 1; }
grep -q 'POSTGRES_HOST_AUTH_METHOD' "$E2E_COMPOSE" && { echo "ERROR: trust auth en compose E2E" >&2; exit 1; }
echo "OK Aislamiento validado"

# Ephemeral credentials via Python helper
eval "$(python3 "$ROOT_DIR/scripts/_gen-e2e-secrets.py")"
printf 'POSTGRES_PASSWORD=%s
' "$PG_PASSWORD" > "$ENV_FILE"
printf 'BETTER_AUTH_SECRET=%s
' "$BETTER_AUTH_SECRET" >> "$ENV_FILE"
printf 'E2E_INTERNAL_SECRET=%s
' "$E2E_INTERNAL_SECRET" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Credenciales efimeras generadas."

# Tear down previous environment
echo "-> Destruyendo entorno E2E Auth previo..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans --timeout 10 2>&1 || true
docker volume rm -f "${E2E_PROJECT}"_e2e_auth_postgres_data 2>/dev/null || true
sleep 3

if docker ps -a --filter "name=${E2E_PROJECT}" -q 2>/dev/null | grep -q .; then
  echo "ERROR: contenedores E2E Auth residuales" >&2
  exit 1
fi

# Start services
echo "Iniciando servicios E2E Auth..."
POSTGRES_PASSWORD="$PG_PASSWORD"   BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET"   E2E_INTERNAL_SECRET="$E2E_INTERNAL_SECRET"   docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" up -d --wait --build 2>&1

# Verify PostgreSQL
if ! docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" ps --status running 2>/dev/null | grep -q postgres; then
  echo "ERROR: PostgreSQL no arranco. Logs:" >&2
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" logs postgres 2>&1 | tail -40 >&2
  exit 1
fi

# Verify API
if ! docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" ps --status running 2>/dev/null | grep -q api; then
  echo "ERROR: API no arranco. Logs:" >&2
  docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" logs api 2>&1 | tail -40 >&2
  exit 1
fi

# Migrations
echo "Ejecutando migraciones..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/migrate.js

# Seed
echo "Ejecutando seed..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api node apps/api/dist/db/seed.js

# Test data: bootstrap organization + admin
echo "Bootstrapping organizacion y admin..."
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api   node apps/api/dist/auth/cli.js bootstrap-organization --yes || true
docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" exec -T api   node apps/api/dist/auth/cli.js bootstrap-admin --email admin@e2e.test --name "Admin E2E" --yes || true

# Test data: coinvest leads via API
echo "Creando leads de coinversion..."
curl -sS -X POST http://127.0.0.1:8090/api/coinvest   -H "Content-Type: application/json"   -d '{"name":"Inversor A","email":"investor_a@e2e.test","phone":"+34 600 000 001","profile":"Inversor particular","experience":"Alguna inversion previa","interests":"Proyectos residenciales en Vigo","consent":true,"submittedAfterMs":3500,"website":""}'   || echo "WARNING: lead A fallo (no fatal)"
curl -sS -X POST http://127.0.0.1:8090/api/coinvest   -H "Content-Type: application/json"   -d '{"name":"Inversor B","email":"investor_b@e2e.test","phone":"+34 600 000 002","profile":"Empresa","experience":"Experiencia habitual","interests":"Proyectos comerciales","consent":true,"submittedAfterMs":3500,"website":""}'   || echo "WARNING: lead B fallo (no fatal)"

# Wait for frontend
echo "Esperando frontend..."
for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:8090/health >/dev/null 2>&1 &&      curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
    echo "Listo (${i}s)."
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:8090/health >/dev/null
curl -fsS http://127.0.0.1:8090/api/health >/dev/null

# Run Playwright
echo "Ejecutando Playwright (auth)..."
export E2E_INTERNAL_SECRET
pnpm --filter @realstate/web exec playwright test   --config playwright.auth.config.ts   --project=chromium   --workers=1   --retries=0   --reporter=line
