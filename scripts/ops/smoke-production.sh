#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-current_postgres-data}"
EXPECTED_CONTAINERS="${EXPECTED_CONTAINERS:-current-proxy-1 current-api-1 current-postgres-1 current-frontend-1}"
BODY=""

usage() {
  cat <<'EOF'
Uso: scripts/ops/smoke-production.sh [--help]

Smoke read-only de producción Realstate. No modifica .env, DB, contenedores,
volúmenes ni flags. No imprime secretos, cookies, tokens ni enlaces privados.

Variables opcionales:
  BASE_URL              URL local a comprobar (default: http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088})
  POSTGRES_VOLUME       Volumen PostgreSQL esperado (default: current_postgres-data)
  EXPECTED_CONTAINERS   Lista de contenedores esperados separados por espacios

Checks:
  - /health, /api/health, /api/config/public
  - /acceso/login, /admin
  - /api/auth/get-session sin cookie -> 200 body null
  - /api/auth/me sin cookie -> 401
  - /api/v1/admin/dashboard sin cookie -> 401
  - current_* contenedores up
  - current_postgres-data presente
  - recursos E2E residuales = 0
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

failures=0
warnings=0

ok() { printf 'OK %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL %s\n' "$*"; failures=$((failures + 1)); }

curl_body() {
  local path="$1"
  local expected_code="$2"
  local tmp code
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w '%{http_code}' "${BASE_URL}${path}" || true)"
  BODY="$(cat "$tmp")"
  rm -f "$tmp"
  if [[ "$code" != "$expected_code" ]]; then
    fail "${path} HTTP ${code}, esperado ${expected_code}"
  else
    ok "${path} HTTP ${expected_code}"
  fi
}

curl_code() {
  local path="$1"
  local expected_code="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${path}" || true)"
  if [[ "$code" != "$expected_code" ]]; then
    fail "${path} HTTP ${code}, esperado ${expected_code}"
  else
    ok "${path} HTTP ${expected_code}"
  fi
}

count_e2e_resources() {
  local total=0
  if ! command -v docker >/dev/null 2>&1; then
    fail 'Docker no disponible; no se pueden comprobar recursos E2E'
    return 0
  fi

  local containers volumes networks
  containers="$(docker ps -a --format '{{.Names}}' | awk '/realstate-e2e|e2e-auth/{c++}END{print c+0}')"
  volumes="$(docker volume ls --format '{{.Name}}' | awk '/realstate-e2e|e2e-auth/{c++}END{print c+0}')"
  networks="$(docker network ls --format '{{.Name}}' | awk '/realstate-e2e|e2e-auth/{c++}END{print c+0}')"
  total=$((containers + volumes + networks))
  printf 'INFO e2e_containers=%s e2e_volumes=%s e2e_networks=%s\n' "$containers" "$volumes" "$networks"
  if [[ "$total" -eq 0 ]]; then
    ok 'recursos E2E residuales = 0'
  else
    fail "recursos E2E residuales detectados: ${total}"
  fi
}

printf '== Realstate production smoke ==\n'
printf 'base_url=redacted local-check\n'

curl_body /health 200
[[ "$BODY" == *"ok"* ]] && ok '/health body ok' || fail '/health body no contiene ok'

curl_body /api/health 200
[[ "$BODY" == *'"postgres":"ok"'* ]] && ok '/api/health postgres ok' || fail '/api/health no confirma postgres ok'

curl_body /api/config/public 200
[[ "$BODY" == *'"authEnabled":true'* ]] && ok 'authEnabled=true público' || fail 'authEnabled público no es true'
[[ "$BODY" == *'"betterAuthRequire2FA":false'* ]] && ok 'betterAuthRequire2FA=false público' || fail 'betterAuthRequire2FA público no es false'

curl_code /acceso/login 200
curl_code /admin 200

curl_body /api/auth/get-session 200
[[ "$BODY" == "null" ]] && ok '/api/auth/get-session sin cookie body null' || fail '/api/auth/get-session sin cookie no devuelve null'

curl_code /api/auth/me 401
curl_code /api/v1/admin/dashboard 401

if command -v docker >/dev/null 2>&1; then
  for container in $EXPECTED_CONTAINERS; do
    if docker ps --format '{{.Names}}' | grep -qx "$container"; then
      ok "contenedor ${container} up"
    else
      fail "contenedor ${container} no está up"
    fi
  done
  if docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1; then
    ok "volumen ${POSTGRES_VOLUME} presente"
  else
    fail "volumen ${POSTGRES_VOLUME} no encontrado"
  fi
else
  fail 'Docker no disponible; no se pueden comprobar contenedores ni volumen'
fi

count_e2e_resources

if [[ "$failures" -ne 0 ]]; then
  printf 'RESULT=fail failures=%s warnings=%s\n' "$failures" "$warnings"
  exit 1
fi

printf 'RESULT=ok failures=0 warnings=%s\n' "$warnings"
exit 0
