#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 <email> --yes"
  echo "  email        Email del usuario a revocar"
  echo "  --yes        REQUERIDO. Esta operación es irreversible"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage
[[ -z "${1:-}" ]] && { echo "ERROR: Email requerido"; exit 1; }
[[ "$*" != *"--yes"* ]] && { echo "ERROR: --yes requerido para operación irreversible"; exit 1; }

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts revoke-user "$@"

