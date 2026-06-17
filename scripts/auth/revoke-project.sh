#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 --email <email> --project-slug <slug> [--reason ...] [--yes]"
  echo "  --email         Email del usuario"
  echo "  --project-slug  Slug del proyecto"
  echo "  --reason        Motivo de la revocación"
  echo "  --yes           Confirmar sin preguntar"
  echo "  --help          Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts revoke-project "$@"

