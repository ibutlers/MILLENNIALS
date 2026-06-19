#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_COMPOSE="$ROOT_DIR/e2e/docker-compose.e2e-auth.yml"

# ── Dynamic isolation: ports and project name derived from env or task id ──
TASK_ID="${HERMES_KANBAN_TASK:-manual}"
E2E_PROJECT="${E2E_AUTH_PROJECT:-realstate-e2e-auth-${TASK_ID}}"
API_PORT="${E2E_AUTH_API_PORT:-8303}"
WEB_PORT="${E2E_AUTH_WEB_PORT:-8304}"
PG_PORT="${E2E_AUTH_PG_PORT:-5433}"
BASE_URL="http://127.0.0.1:${WEB_PORT}"
BETTER_AUTH_URL="${BASE_URL}"

export E2E_AUTH_API_PORT="$API_PORT"
export E2E_AUTH_WEB_PORT="$WEB_PORT"
export E2E_AUTH_PG_PORT="$PG_PORT"
export BETTER_AUTH_URL

ENV_FILE="/tmp/realstate-e2e-auth-env-$$.env"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$E2E_COMPOSE" -p "$E2E_PROJECT" "$@"
}

cleanup() {
  local status=$?
  echo ""
  echo "=== E2E AUTH TEARDOWN (project: ${E2E_PROJECT}) ==="
  if [[ -f "$ENV_FILE" ]]; then
    compose down -v --remove-orphans --timeout 10 2>/dev/null || true
  else
    docker compose -f "$E2E_COMPOSE" -p "$E2E_PROJECT" down -v --remove-orphans --timeout 10 2>/dev/null || true
  fi
  rm -f "$ENV_FILE"
  unset POSTGRES_PASSWORD PG_PASSWORD BETTER_AUTH_SECRET E2E_INTERNAL_SECRET
  unset E2E_AUTH_API_PORT E2E_AUTH_WEB_PORT E2E_AUTH_PG_PORT BETTER_AUTH_URL
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

echo "=== E2E AUTH SETUP (project: ${E2E_PROJECT}, ports: api=${API_PORT} web=${WEB_PORT} pg=${PG_PORT}) ==="

# Isolation validation
grep -q 'current_postgres-data' "$E2E_COMPOSE" && { echo "ERROR: volumen de produccion en compose E2E" >&2; exit 1; }
grep -q 'shared/.env' "$E2E_COMPOSE" && { echo "ERROR: shared/.env en compose E2E" >&2; exit 1; }
grep -q '8088' "$E2E_COMPOSE" && { echo "ERROR: puerto de produccion 8088 en compose E2E" >&2; exit 1; }
grep -q 'POSTGRES_HOST_AUTH_METHOD' "$E2E_COMPOSE" && { echo "ERROR: trust auth en compose E2E" >&2; exit 1; }
echo "OK Aislamiento validado"

# Ephemeral credentials via Python helper
eval "$(python3 "$ROOT_DIR/scripts/_gen-e2e-secrets.py")"
export POSTGRES_PASSWORD="$PG_PASSWORD"
: "${POSTGRES_PASSWORD:?missing POSTGRES_PASSWORD}"
: "${BETTER_AUTH_SECRET:?missing BETTER_AUTH_SECRET}"
: "${E2E_INTERNAL_SECRET:?missing E2E_INTERNAL_SECRET}"
printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD" > "$ENV_FILE"
printf 'BETTER_AUTH_SECRET=%s\n' "$BETTER_AUTH_SECRET" >> "$ENV_FILE"
printf 'E2E_INTERNAL_SECRET=%s\n' "$E2E_INTERNAL_SECRET" >> "$ENV_FILE"
printf 'BETTER_AUTH_URL=%s\n' "$BETTER_AUTH_URL" >> "$ENV_FILE"
printf 'E2E_AUTH_API_PORT=%s\n' "$API_PORT" >> "$ENV_FILE"
printf 'E2E_AUTH_WEB_PORT=%s\n' "$WEB_PORT" >> "$ENV_FILE"
printf 'E2E_AUTH_PG_PORT=%s\n' "$PG_PORT" >> "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "Credenciales efimeras generadas."

# Tear down previous environment
echo "-> Destruyendo entorno E2E Auth previo... (project: ${E2E_PROJECT})"
compose down -v --remove-orphans --timeout 10 2>&1 || true
docker volume rm -f "${E2E_PROJECT}"_e2e_auth_postgres_data 2>/dev/null || true
sleep 3

if docker ps -a --filter "name=${E2E_PROJECT}" -q 2>/dev/null | grep -q .; then
  echo "ERROR: contenedores E2E Auth residuales" >&2
  exit 1
fi

# Start services
echo "Iniciando servicios E2E Auth..."
compose up -d --wait --build 2>&1

is_service_running() {
  local service="$1"
  local cid
  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  [[ -n "$cid" ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null || true)" == "true" ]]
}

# Verify PostgreSQL
if ! is_service_running postgres; then
  echo "ERROR: PostgreSQL no arranco. Logs:" >&2
  compose logs postgres 2>&1 | tail -40 >&2
  exit 1
fi

# Verify API
if ! is_service_running api; then
  echo "ERROR: API no arranco. Logs:" >&2
  compose logs api 2>&1 | tail -40 >&2
  exit 1
fi

# Migrations
echo "Ejecutando migraciones..."
compose exec -T api node apps/api/dist/db/migrate.js

# Seed
echo "Ejecutando seed..."
compose exec -T api node apps/api/dist/db/seed.js

# Test data: bootstrap organization + admin
echo "Bootstrapping organizacion y admin..."
compose exec -T api node apps/api/dist/auth/cli.js bootstrap-organization --yes || true
compose exec -T api node apps/api/dist/auth/cli.js bootstrap-admin --email admin@e2e.test --name "Admin E2E" --yes || true

# Test data: coinvest leads via API
echo "Creando leads de coinversion..."
curl -sS -X POST "${BASE_URL}/api/coinvest" -H "Content-Type: application/json" -d '{"name":"Inversor A","email":"investor_a@e2e.test","phone":"+34 600 000 001","profile":"Inversor particular","experience":"Alguna inversion previa","interests":"Proyectos residenciales en Vigo","consent":true,"submittedAfterMs":3500,"website":""}' || echo "WARNING: lead A fallo (no fatal)"
curl -sS -X POST "${BASE_URL}/api/coinvest" -H "Content-Type: application/json" -d '{"name":"Inversor B","email":"investor_b@e2e.test","phone":"+34 600 000 002","profile":"Empresa","experience":"Experiencia habitual","interests":"Proyectos comerciales","consent":true,"submittedAfterMs":3500,"website":""}' || echo "WARNING: lead B fallo (no fatal)"

# Wait for frontend and API with active polling
echo "Esperando servicios (PostgreSQL + API + Frontend + migraciones)..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  PG_OK=false
  API_OK=false
  FE_OK=false

  if curl -fsS "${BASE_URL}/api/health" 2>/dev/null | grep -q '"ok"'; then
    API_OK=true
    AUTH_STATUS=$(curl -fsS "${BASE_URL}/api/config/public" 2>/dev/null | grep -o '"authEnabled":true' || true)
    if [ -n "$AUTH_STATUS" ]; then
      PG_OK=true
    fi
  fi

  if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
    FE_OK=true
  fi

  if $PG_OK && $API_OK && $FE_OK; then
    echo "Todos los servicios listos (${WAITED}s)."
    break
  fi

  sleep 2
  WAITED=$((WAITED + 2))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "ERROR: Timeout esperando servicios tras ${MAX_WAIT}s." >&2
    echo "  API: $API_OK  PG+Auth: $PG_OK  Frontend: $FE_OK" >&2
    echo "  API logs:" >&2
    compose logs api 2>&1 | tail -20 >&2
    exit 1
  fi
done

# Secret fingerprint validation (safe, no secret exposed)
echo "Validando fingerprint del secreto E2E..."
SERVER_FP=$(curl -fsS "${BASE_URL}/api/e2e/auth/fingerprint" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['fingerprint'])" 2>/dev/null || echo "FAILED")
CLIENT_FP=$(python3 -c "
import hashlib, os
secret = os.environ.get('E2E_INTERNAL_SECRET', '')
if not secret:
    print('empty-secret')
else:
    h = hashlib.sha256(f'realstate-e2e-auth:{secret}'.encode()).hexdigest()[:16]
    print(h)
")
if [ "$SERVER_FP" = "$CLIENT_FP" ] && [ "$SERVER_FP" != "FAILED" ] && [ -n "$SERVER_FP" ]; then
  echo "Fingerprint coincide: ${SERVER_FP}"
else
  echo "ERROR: Fingerprint no coincide: servidor=${SERVER_FP}, cliente=${CLIENT_FP}" >&2
  echo "Verifica que E2E_INTERNAL_SECRET es identico en API y Playwright." >&2
  exit 1
fi

# Run Playwright. Preserve the Playwright exit code; cleanup trap must not mask failures.
echo "Ejecutando Playwright (auth)..."
export E2E_INTERNAL_SECRET
export E2E_AUTH_BASE_URL="$BASE_URL"
export E2E_AUTH_API_PORT="$API_PORT"
export E2E_AUTH_WEB_PORT="$WEB_PORT"
status=0
pnpm --filter @realstate/web exec playwright test \
  --config playwright.auth.config.ts \
  --project=chromium \
  --workers=1 \
  --retries=0 \
  --reporter=line \
  "$@" || status=$?
if [[ "$status" -ne 0 ]]; then
  echo "=== API logs tras fallo Playwright === (project: ${E2E_PROJECT})" >&2
  compose logs api 2>&1 | tail -120 >&2 || true
fi
exit "$status"
