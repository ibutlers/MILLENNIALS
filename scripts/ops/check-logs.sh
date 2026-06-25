#!/usr/bin/env bash
set -Eeuo pipefail

API_CONTAINER="${API_CONTAINER:-current-api-1}"
SINCE="${SINCE:-24h}"
MAX_BYTES="${MAX_BYTES:-10485760}"

usage() {
  cat <<'EOF'
Uso: scripts/ops/check-logs.sh [--help]

Auditoría read-only de logs recientes del contenedor API. No imprime líneas de
log completas para evitar secretos/cookies/tokens; solo conteos sanitizados.
No modifica contenedores, DB, volúmenes ni .env.

Variables opcionales:
  API_CONTAINER  Contenedor API (default: current-api-1)
  SINCE          Ventana para docker logs --since (default: 24h)
  MAX_BYTES      Límite de bytes analizados del final del log (default: 10485760)

Detecta:
  - errores críticos recientes
  - posibles secretos/tokens/cookies en logs
  - stack traces repetidos
  - fallos SMTP/auth/DB
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

failures=0
warnings=0
tmp=""

cleanup() {
  if [[ -n "${tmp:-}" ]]; then
    rm -f "$tmp" "${tmp}.tail"
  fi
}
trap cleanup EXIT

ok() { printf 'OK %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL %s\n' "$*"; failures=$((failures + 1)); }

printf '== Realstate API logs check ==\n'
printf 'container=%s since=%s\n' "$API_CONTAINER" "$SINCE"

if ! command -v docker >/dev/null 2>&1; then
  fail 'Docker no disponible'
elif ! docker ps --format '{{.Names}}' | grep -qx "$API_CONTAINER"; then
  fail "contenedor ${API_CONTAINER} no está up"
else
  tmp="$(mktemp)"
  if docker logs --since "$SINCE" "$API_CONTAINER" > "$tmp" 2>&1; then
    ok 'docker logs leído correctamente'
  else
    fail 'docker logs devolvió error; se analiza salida capturada sin imprimir líneas'
  fi
  bytes="$(wc -c < "$tmp" | tr -d ' ')"
  if [[ "$bytes" -gt "$MAX_BYTES" ]]; then
    tail -c "$MAX_BYTES" "$tmp" > "${tmp}.tail"
    mv "${tmp}.tail" "$tmp"
    warn "logs recortados a últimos ${MAX_BYTES} bytes para análisis seguro"
  fi

  export LOG_FILE="$tmp"
  counts="$(LOG_FILE="$tmp" python3 - <<'PY'
import os
import re
from pathlib import Path
text = Path(os.environ["LOG_FILE"]).read_text(errors="replace")
patterns = {
    "critical": r"(?i)(fatal|panic|uncaught|unhandled|EADDRINUSE|ECONNREFUSED|migration failed|database connection|postgres(?:ql)?[^\n]{0,80}(?:failed|error)|smtp[^\n]{0,80}(?:failed|error))",
    "generic_error": r"(?i)(^|\b)(error|failed|exception)(\b|:)",
    "stack_trace": r"(?m)(^\s+at\s+\S+\s*\(|Traceback \(most recent call last\))",
    "secret_leak": r"(?i)(BETTER_AUTH_SECRET|SMTP_PASSWORD|DATABASE_URL|POSTGRES_PASSWORD|Set-Cookie:|Authorization:\s*Bearer|reset[^\n]{0,40}token|verification[^\n]{0,40}token|password=|token=|secret=)",
    "smtp_issue": r"(?i)(smtp[^\n]{0,80}(fail|error|timeout|reject))",
    "auth_issue": r"(?i)(auth[^\n]{0,80}(fail|error|invalid|unauthorized))",
    "db_issue": r"(?i)((database|postgres|pool)[^\n]{0,80}(fail|error|timeout|refused))",
}
print(" ".join(f"{name}={len(re.findall(pattern, text))}" for name, pattern in patterns.items()))
PY
)"

  critical="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^critical=//p')"
  generic_error="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^generic_error=//p')"
  stack_trace="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^stack_trace=//p')"
  secret_leak="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^secret_leak=//p')"
  smtp_issue="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^smtp_issue=//p')"
  auth_issue="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^auth_issue=//p')"
  db_issue="$(printf '%s\n' "$counts" | tr ' ' '\n' | sed -n 's/^db_issue=//p')"

  printf 'INFO critical=%s generic_error=%s stack_trace=%s secret_leak=%s smtp_issue=%s auth_issue=%s db_issue=%s\n' \
    "$critical" "$generic_error" "$stack_trace" "$secret_leak" "$smtp_issue" "$auth_issue" "$db_issue"

  [[ "$secret_leak" -eq 0 ]] && ok 'sin patrones obvios de secretos/tokens/cookies en logs' || fail "posibles secretos/tokens/cookies en logs: ${secret_leak}"
  [[ "$critical" -eq 0 ]] && ok 'sin errores críticos recientes' || fail "errores críticos recientes detectados: ${critical}"
  [[ "$smtp_issue" -eq 0 ]] && ok 'sin fallos SMTP recientes' || warn "fallos SMTP recientes detectados: ${smtp_issue}"
  [[ "$auth_issue" -eq 0 ]] && ok 'sin fallos auth recientes' || warn "fallos auth recientes detectados: ${auth_issue}"
  [[ "$db_issue" -eq 0 ]] && ok 'sin fallos DB recientes' || warn "fallos DB recientes detectados: ${db_issue}"
  [[ "$stack_trace" -eq 0 ]] && ok 'sin stack traces recientes' || warn "stack traces recientes detectados: ${stack_trace}"
  [[ "$generic_error" -eq 0 ]] && ok 'sin errores genéricos recientes' || warn "errores genéricos recientes detectados: ${generic_error}"
fi

if [[ "$failures" -ne 0 ]]; then
  printf 'RESULT=fail failures=%s warnings=%s\n' "$failures" "$warnings"
  exit 1
fi

printf 'RESULT=ok failures=0 warnings=%s\n' "$warnings"
exit 0
