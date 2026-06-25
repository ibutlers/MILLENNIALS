#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088}}"
AUTH_CHECK_SCRIPT="${AUTH_CHECK_SCRIPT:-}"
BODY=""

usage() {
  cat <<'EOF'
Uso: scripts/ops/check-auth-posture.sh [--help]

Verificación read-only de postura auth/admin en producción. No modifica .env,
DB, contenedores, volúmenes ni flags. No imprime secretos, cookies, tokens ni
enlaces privados.

Variables opcionales:
  BASE_URL            URL local a comprobar (default: http://127.0.0.1:${REALSTATE_HTTP_PORT:-8088})
  AUTH_CHECK_SCRIPT   Ruta explícita a check-temporary-http-ip.sh si no está en el repo actual

Checks:
  - /api/config/public -> authEnabled=true, betterAuthRequire2FA=false
  - /api/auth/me sin cookie -> 401
  - /api/v1/admin/dashboard sin cookie -> 401
  - endpoints /api/e2e/auth/* -> 404
  - scripts/auth/check-temporary-http-ip.sh si está disponible
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

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
if [[ -z "$AUTH_CHECK_SCRIPT" ]]; then
  AUTH_CHECK_SCRIPT="${repo_root}/scripts/auth/check-temporary-http-ip.sh"
fi

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

printf '== Realstate auth posture check ==\n'
printf 'base_url=redacted local-check\n'

curl_body /api/config/public 200
[[ "$BODY" == *'"authEnabled":true'* ]] && ok 'authEnabled=true público' || fail 'authEnabled público no es true'
[[ "$BODY" == *'"betterAuthRequire2FA":false'* ]] && ok 'MFA obligatorio desactivado público' || fail 'betterAuthRequire2FA público no es false'

curl_code /api/auth/me 401
curl_code /api/v1/admin/dashboard 401

for endpoint in \
  /api/e2e/auth/captured-emails \
  /api/e2e/auth/user-status \
  /api/e2e/auth/mfa-policy \
  /api/e2e/auth/invitation-token; do
  curl_code "$endpoint" 404
done

if [[ -x "$AUTH_CHECK_SCRIPT" ]]; then
  printf '== Delegated temporary HTTP/IP posture check ==\n'
  if BASE_URL="$BASE_URL" "$AUTH_CHECK_SCRIPT"; then
    ok 'check-temporary-http-ip pasó'
  else
    fail 'check-temporary-http-ip falló'
  fi
else
  warn "No se encontró script ejecutable: ${AUTH_CHECK_SCRIPT}"
fi

if [[ "$failures" -ne 0 ]]; then
  printf 'RESULT=fail failures=%s warnings=%s\n' "$failures" "$warnings"
  exit 1
fi

printf 'RESULT=ok failures=0 warnings=%s\n' "$warnings"
exit 0
