#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 <email> [--pii]"
  echo "  email        Email del usuario a reconciliar"
  echo "  --pii        Mostrar emails completos"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage
[[ -z "${1:-}" ]] && { echo "ERROR: Email requerido"; exit 1; }

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts reconcile-user "$@"

