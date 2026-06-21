#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

usage() {
  cat <<'USAGE'
Uso: scripts/auth/invite-admin.sh --email admin@dominio-real.com [--dry-run] [--pii] [--yes]

Crea una invitación oficial para un segundo administrador real.

Opciones:
  --email      Email real del segundo administrador (requerido)
  --dry-run    Valida precondiciones sin crear invitación ni enviar correo
  --pii        Muestra el email completo en salida operativa
  --yes        Confirmar creación real no interactiva
  --help       Esta ayuda

Seguridad:
  - No imprime token ni enlace completo.
  - Rechaza dominios ficticios en producción.
  - Impide duplicar admin activo o invitación pendiente.
  - Si AUTH_EMAIL_MODE=smtp, envía el email por el proveedor configurado.
USAGE
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

EMAIL=""
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      [[ -n "${2:-}" ]] || { echo "ERROR: --email requiere valor" >&2; exit 1; }
      EMAIL="$2"
      ARGS+=("--email" "$2")
      shift 2
      ;;
    --dry-run|--pii|--yes)
      ARGS+=("$1")
      shift
      ;;
    *)
      echo "ERROR: Argumento desconocido: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$EMAIL" ]]; then
  echo "ERROR: --email requerido" >&2
  usage >&2
  exit 1
fi

cd "$ROOT"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^current-api-1$'; then
  exec docker exec -i current-api-1 node apps/api/dist/auth/cli.js invite-admin "${ARGS[@]}"
else
  exec npx tsx apps/api/src/auth/cli.ts invite-admin "${ARGS[@]}"
fi
