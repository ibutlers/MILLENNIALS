#!/usr/bin/env bash
set -euo pipefail

# contact-requests.sh — consulta operativa de solicitudes de contacto
# Uso:
#   ./scripts/contact-requests.sh          → últimas 10
#   ./scripts/contact-requests.sh 20       → últimas 20
#   ./scripts/contact-requests.sh 5 --pii → muestra email y teléfono completos

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Buscar contenedor PostgreSQL ──
CONTAINER="$(docker ps --filter name=current-postgres --format '{{.Names}}' | head -1)"
if [ -z "$CONTAINER" ]; then
  CONTAINER="$(docker ps --filter name=postgres --format '{{.Names}}' | head -1)"
fi
if [ -z "$CONTAINER" ]; then
  echo "Error: no se encontró un contenedor PostgreSQL activo" >&2
  exit 1
fi

# ── Argumentos ──
LIMIT="${1:-10}"
SHOW_PII=false
if [[ "${2:-}" == "--pii" ]] || [[ "${3:-}" == "--pii" ]]; then
  SHOW_PII=true
fi

# ── Query ──
if $SHOW_PII; then
  QUERY="SELECT
    to_char(created_at, 'YYYY-MM-DD HH24:MI') AS fecha,
    first_name AS nombre,
    email,
    phone AS telefono,
    subject AS motivo,
    status::text AS estado,
    message AS mensaje
  FROM leads
  WHERE kind = 'general_contact' AND source_path = '/contacto'
  ORDER BY created_at DESC
  LIMIT $LIMIT"
else
  QUERY="SELECT
    to_char(created_at, 'YYYY-MM-DD HH24:MI') AS fecha,
    first_name AS nombre,
    left(email, 2) || '***@' || split_part(email, '@', 2) AS email,
    CASE WHEN phone IS NOT NULL THEN left(phone, 3) || '***' || right(phone, 2) ELSE NULL END AS telefono,
    subject AS motivo,
    status::text AS estado,
    left(message, 80) || CASE WHEN length(message) > 80 THEN '…' ELSE '' END AS mensaje
  FROM leads
  WHERE kind = 'general_contact' AND source_path = '/contacto'
  ORDER BY created_at DESC
  LIMIT $LIMIT"
fi

docker exec "$CONTAINER" psql -U realstate -d realstate -c "$QUERY" 2>/dev/null || {
  docker exec "$CONTAINER" psql -U postgres -d realstate -c "$QUERY" 2>/dev/null || {
    echo "Error: no se pudo conectar a PostgreSQL" >&2
    exit 1
  }
}
