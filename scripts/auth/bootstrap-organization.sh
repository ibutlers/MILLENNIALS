#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 [--yes]"
  echo "  --yes   Confirmar sin preguntar"
  echo "  --help  Esta ayuda"
  echo ""
  echo "Crea la organización 'MILLENNIALS CONSTRUYEN' de forma idempotente."
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts bootstrap-organization "$@"

