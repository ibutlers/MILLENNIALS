#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 [--status pending|accepted|expired|revoked] [--email ...] [--limit N] [--pii]"
  echo "  --status     Filtrar por estado"
  echo "  --email      Filtrar por email (normalizado)"
  echo "  --limit      Máximo de resultados (default: 50)"
  echo "  --pii        Mostrar emails completos"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts list-invitations "$@"

