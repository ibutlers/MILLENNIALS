#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 [--limit N] [--action action] [--actor email] [--subject email] [--pii]"
  echo "  --limit    Máximo de eventos (default: 50, max: 200)"
  echo "  --action   Filtrar por acción"
  echo "  --actor    Filtrar por actor email"
  echo "  --subject  Filtrar por sujeto/metadata email"
  echo "  --pii        Mostrar emails completos"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts audit-log "$@"

