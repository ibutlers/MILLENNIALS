#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 --email <email> --name <nombre> [--password <password>] [--yes]"
  echo "  --email      Email del administrador"
  echo "  --name       Nombre completo"
  echo "  --password   Contraseña (si no se proporciona, se genera una)"
  echo "  --yes        Confirmar sin preguntar"
  echo "  --help       Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts bootstrap-admin "$@"

