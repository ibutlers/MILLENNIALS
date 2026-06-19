#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 <email> [--pii] [--yes]"
  echo "  email        Email del usuario"
  echo "  --pii        Mostrar email completo"
  echo "  --yes        Confirmar sin preguntar (requerido)"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage
[[ -z "${1:-}" ]] && { echo "ERROR: Email requerido"; exit 1; }

cd "$ROOT"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^current-api-1$'; then
  exec docker exec -i current-api-1 node apps/api/dist/auth/cli.js reset-mfa "$@"
else
  exec npx tsx apps/api/src/auth/cli.ts reset-mfa "$@"
fi
