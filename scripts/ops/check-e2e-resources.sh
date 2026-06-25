#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Uso: scripts/ops/check-e2e-resources.sh [--help]

Comprueba de forma read-only que no quedan contenedores, volúmenes ni redes E2E
residuales (`realstate-e2e` o `e2e-auth`). No borra recursos.

Variables opcionales:
  E2E_RESOURCE_PATTERN  Regex de recursos E2E (default: realstate-e2e|e2e-auth)
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

pattern="${E2E_RESOURCE_PATTERN:-realstate-e2e|e2e-auth}"
failures=0
warnings=0

ok() { printf 'OK %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL %s\n' "$*"; failures=$((failures + 1)); }

count_matches() {
  local command_output="$1"
  printf '%s\n' "$command_output" | awk -v pattern="$pattern" '$0 ~ pattern {c++} END {print c+0}'
}

printf '== Realstate E2E resources check ==\n'

if ! command -v docker >/dev/null 2>&1; then
  fail 'Docker no disponible'
else
  containers="$(count_matches "$(docker ps -a --format '{{.Names}}')")"
  volumes="$(count_matches "$(docker volume ls --format '{{.Name}}')")"
  networks="$(count_matches "$(docker network ls --format '{{.Name}}')")"
  printf 'INFO e2e_containers=%s e2e_volumes=%s e2e_networks=%s\n' "$containers" "$volumes" "$networks"
  if [[ "$containers" -eq 0 && "$volumes" -eq 0 && "$networks" -eq 0 ]]; then
    ok 'recursos E2E residuales = 0'
  else
    fail 'existen recursos E2E residuales; revisar antes de cerrar QA'
  fi
fi

if [[ "$failures" -ne 0 ]]; then
  printf 'RESULT=fail failures=%s warnings=%s\n' "$failures" "$warnings"
  exit 1
fi

printf 'RESULT=ok failures=0 warnings=%s\n' "$warnings"
exit 0
