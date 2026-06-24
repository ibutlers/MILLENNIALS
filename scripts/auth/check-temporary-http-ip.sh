#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}}"
API_CONTAINER="${API_CONTAINER:-current-api-1}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-current_postgres-data}"
BODY=""

usage() {
  cat <<'EOF'
Uso: scripts/auth/check-temporary-http-ip.sh [--help]

Verifica de forma read-only la postura temporal Realstate auth/admin sobre HTTP/IP.

Variables opcionales:
  BASE_URL            URL local a comprobar (default: http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088})
  API_CONTAINER       Contenedor API para checks de flags sin imprimir valores (default: current-api-1)
  POSTGRES_VOLUME     Volumen PostgreSQL esperado (default: current_postgres-data)

Comprueba:
  - /health, /api/health, /api/config/public
  - /acceso/login, /admin
  - /api/auth/get-session sin cookie
  - /api/auth/me y /api/v1/admin/dashboard sin cookie
  - endpoints E2E no expuestos
  - flags temporales esperados si el contenedor API está disponible
  - presencia de SMTP sin mostrar valores
  - presencia del volumen PostgreSQL si Docker está disponible

No modifica .env, DB, contenedores, volúmenes ni flags. No imprime secretos,
tokens, cookies ni enlaces privados.
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

printf '== Realstate temporal HTTP/IP check ==\n'
printf 'base_url=redacted scheme=http/local-check\n'

curl_body /health 200
health_body="$BODY"
if [[ "$health_body" == *"ok"* ]]; then ok '/health body ok'; else fail '/health body no contiene ok'; fi

curl_body /api/health 200
api_health_body="$BODY"
if [[ "$api_health_body" == *'"postgres":"ok"'* ]]; then ok '/api/health postgres ok'; else fail '/api/health no confirma postgres ok'; fi

curl_body /api/config/public 200
public_config_body="$BODY"
if [[ "$public_config_body" == *'"authEnabled":true'* ]]; then ok 'authEnabled=true público'; else fail 'authEnabled público no es true'; fi
if [[ "$public_config_body" == *'"betterAuthRequire2FA":false'* ]]; then ok 'betterAuthRequire2FA=false público'; else fail 'betterAuthRequire2FA público no es false'; fi

curl_code /acceso/login 200
curl_code /admin 200

curl_body /api/auth/get-session 200
session_body="$BODY"
if [[ "$session_body" == "null" ]]; then ok '/api/auth/get-session sin cookie body null'; else fail '/api/auth/get-session sin cookie no devuelve null'; fi

curl_code /api/auth/me 401
curl_code /api/v1/admin/dashboard 401

for endpoint in \
  /api/e2e/auth/captured-emails \
  /api/e2e/auth/user-status \
  /api/e2e/auth/mfa-policy \
  /api/e2e/auth/invitation-token; do
  curl_code "$endpoint" 404
done

headers="$(mktemp)"
curl -sS -D "$headers" -o /dev/null "${BASE_URL}/api/auth/get-session" || true
set_cookie_count="$(awk 'BEGIN{IGNORECASE=1}/^set-cookie:/{c++}END{print c+0}' "$headers")"
httponly_count="$(awk 'BEGIN{IGNORECASE=1}/^set-cookie:/{if($0 ~ /;[[:space:]]*HttpOnly(;|$)/) c++}END{print c+0}' "$headers")"
samesite_count="$(awk 'BEGIN{IGNORECASE=1}/^set-cookie:/{if($0 ~ /;[[:space:]]*SameSite=/) c++}END{print c+0}' "$headers")"
secure_count="$(awk 'BEGIN{IGNORECASE=1}/^set-cookie:/{if($0 ~ /;[[:space:]]*Secure(;|$)/) c++}END{print c+0}' "$headers")"
rm -f "$headers"
printf 'INFO set_cookie_count=%s secure=%s httponly=%s samesite=%s (valores omitidos)\n' "$set_cookie_count" "$secure_count" "$httponly_count" "$samesite_count"
if [[ "$set_cookie_count" -gt 0 ]]; then
  [[ "$httponly_count" == "$set_cookie_count" ]] && ok 'cookies con HttpOnly' || fail 'alguna cookie no tiene HttpOnly'
  [[ "$samesite_count" == "$set_cookie_count" ]] && ok 'cookies con SameSite' || fail 'alguna cookie no tiene SameSite'
  if [[ "$secure_count" -lt "$set_cookie_count" ]]; then
    warn 'cookie Secure no exigida por ventana HTTP temporal; debe corregirse al migrar a HTTPS'
  fi
else
  ok 'sin Set-Cookie en get-session anónimo'
fi

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
  docker_check() {
    local label="$1"
    local command="$2"
    if docker exec "$API_CONTAINER" sh -lc "$command" >/dev/null 2>&1; then
      ok "$label"
    else
      fail "$label"
    fi
  }

  docker_check 'AUTH_MODE esperado en contenedor API' '[ "${AUTH_MODE:-}" = "better-auth" ]'
  docker_check 'AUTH_EMAIL_MODE esperado en contenedor API' '[ "${AUTH_EMAIL_MODE:-}" = "smtp" ]'
  docker_check 'ADMIN_ENABLED esperado en contenedor API' '[ "${ADMIN_ENABLED:-}" = "true" ]'
  docker_check 'AUTH_ALLOW_INSECURE_IP_TEST temporal activo' '[ "${AUTH_ALLOW_INSECURE_IP_TEST:-}" = "true" ]'
  docker_check 'BETTER_AUTH_REQUIRE_2FA opcional' '[ "${BETTER_AUTH_REQUIRE_2FA:-false}" = "false" ]'
  docker_check 'APP_BASE_URL temporal por HTTP' 'case "${APP_BASE_URL:-}" in http://*) exit 0;; *) exit 1;; esac'
  docker_check 'BETTER_AUTH_URL temporal por HTTP' 'case "${BETTER_AUTH_URL:-}" in http://*) exit 0;; *) exit 1;; esac'
  docker_check 'BETTER_AUTH_TRUSTED_ORIGINS presente' '[ -n "${BETTER_AUTH_TRUSTED_ORIGINS:-}" ]'
  docker_check 'SESSION_COOKIE_SECURE coherente con HTTP temporal' '[ "${SESSION_COOKIE_SECURE:-}" = "false" ]'
  docker_check 'SMTP_HOST presente' '[ -n "${SMTP_HOST:-}" ]'
  docker_check 'SMTP_PORT presente' '[ -n "${SMTP_PORT:-}" ]'
  docker_check 'SMTP_USER presente' '[ -n "${SMTP_USER:-}" ]'
  docker_check 'SMTP_PASSWORD presente' '[ -n "${SMTP_PASSWORD:-}" ]'
else
  warn "Docker o contenedor ${API_CONTAINER} no disponible; se omiten checks de flags y SMTP"
fi

if command -v docker >/dev/null 2>&1; then
  if docker volume inspect "$POSTGRES_VOLUME" >/dev/null 2>&1; then
    ok "volumen ${POSTGRES_VOLUME} presente"
  else
    fail "volumen ${POSTGRES_VOLUME} no encontrado"
  fi
else
  warn 'Docker no disponible; se omite check de volumen'
fi

if [[ "$failures" -ne 0 ]]; then
  printf 'RESULT=fail failures=%s warnings=%s\n' "$failures" "$warnings"
  exit 1
fi

printf 'RESULT=ok failures=0 warnings=%s\n' "$warnings"
exit 0
