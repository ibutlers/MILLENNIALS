#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 <referencia> [--pii]"
  echo "  referencia   Referencia pública de la invitación (INV-...)"
  echo "  --pii        Mostrar emails completos"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage
[[ -z "${1:-}" ]] && { echo "ERROR: Referencia de invitación requerida"; exit 1; }

REF="$1"; shift
PII=""; [[ "${1:-}" == "--pii" ]] && PII="--pii"

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts resend-invitation "$REF" $PII

