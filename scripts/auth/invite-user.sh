#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 --email user@example.com [--role investor|operator|admin] [--send] [--pii] [--yes]"
  echo "  --email       Email del usuario a invitar"
  echo "  --role        Rol a asignar (default: investor; staff se acepta como alias legacy de operator)"
  echo "  --send        Enviar correo de invitación por el proveedor configurado"
  echo "  --pii         Mostrar emails completos"
  echo "  --yes         Confirmar automáticamente"
  echo "  --help        Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

cd "$ROOT"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^current-api-1$'; then
  exec docker exec -i current-api-1 node apps/api/dist/auth/cli.js invite-email "$@"
else
  exec npx tsx apps/api/src/auth/cli.ts invite-email "$@"
fi
