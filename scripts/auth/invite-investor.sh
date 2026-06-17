#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  echo "Uso: $0 --lead-ref RS-... [--role investor|staff|admin] [--send] [--pii] [--yes]"
  echo "  --lead-ref    Referencia pública del lead Coinvierte"
  echo "  --role        Rol a asignar (default: investor)"
  echo "  --send        Enviar correo de invitación (si SMTP configurado)"
  echo "  --pii         Mostrar emails completos"
  echo "  --yes         Confirmar automáticamente"
  echo "  --help        Esta ayuda"
  exit 0
}
[[ "${1:-}" == "--help" ]] && usage

LEAD_REF=""; ROLE="investor"; SEND=""; PII=""; YES=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lead-ref) LEAD_REF="$2"; shift 2;;
    --role) ROLE="$2"; shift 2;;
    --send) SEND="--send"; shift;;
    --pii) PII="--pii"; shift;;
    --yes) YES="--yes"; shift;;
    *) echo "ERROR: Argumento desconocido: $1"; usage;;
  esac
done

[[ -z "$LEAD_REF" ]] && { echo "ERROR: --lead-ref requerido"; exit 1; }

cd "$ROOT"
exec npx tsx apps/api/src/auth/cli.ts invite-investor --lead-ref "$LEAD_REF" --role "$ROLE" $SEND $PII $YES

