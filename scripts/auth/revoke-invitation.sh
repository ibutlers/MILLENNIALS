#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 <referencia> [--reason ...] [--yes]"
  echo "  referencia   Referencia pública (INV-...)"
  echo "  --reason     Motivo de la revocación"
  echo "  --yes        Confirmar sin preguntar"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage
[[ -z "${1:-}" ]] && { echo "ERROR: Referencia de invitación requerida"; exit 1; }

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts revoke-invitation "$@"

