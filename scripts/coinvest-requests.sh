#!/usr/bin/env bash
# ── Co-invest request viewer ──
# Usage: ./scripts/coinvest-requests.sh [limit] [--pii]
#
# Without --pii, email and phone are masked.
# With --pii, full PII is shown.
# Default limit: 10

set -euo pipefail

LIMIT="${1:-10}"
PII=false
[[ "${2:-}" == "--pii" ]] && PII=true
[[ "${1:-}" == "--pii" ]] && PII=true && LIMIT=10

CONTAINER="$(docker ps --filter name=current-postgres --format '{{.Names}}' | head -1)"
if [ -z "$CONTAINER" ]; then
  echo "No PostgreSQL container found" >&2
  exit 1
fi

if $PII; then
  QUERY="
    SELECT
      created_at::timestamptz AT TIME ZONE 'Europe/Madrid' AS fecha,
      first_name AS nombre,
      email,
      phone AS telefono,
      profile AS perfil,
      experience AS experiencia,
      substring(coalesce(interests, ''), 1, 200) AS intereses,
      status AS estado
    FROM leads
    WHERE kind = 'investor_interest' AND source_path = '/coinvierte'
    ORDER BY created_at DESC
    LIMIT $LIMIT"
else
  QUERY="
    SELECT
      created_at::timestamptz AT TIME ZONE 'Europe/Madrid' AS fecha,
      first_name AS nombre,
      left(email, 3) || repeat('*', position('@' in email) - 3) || substring(email from position('@' in email)) AS email,
      left(coalesce(phone, ''), 5) || repeat('*', greatest(length(coalesce(phone, '')) - 7, 0)) || right(coalesce(phone, ''), 2) AS telefono,
      profile AS perfil,
      experience AS experiencia,
      substring(coalesce(interests, ''), 1, 200) AS intereses,
      status AS estado
    FROM leads
    WHERE kind = 'investor_interest' AND source_path = '/coinvierte'
    ORDER BY created_at DESC
    LIMIT $LIMIT"
fi

docker exec "$CONTAINER" psql -U realstate -d realstate -c "$QUERY" 2>/dev/null || {
  docker exec "$CONTAINER" psql -U postgres -d realstate -c "$QUERY" 2>/dev/null || {
    echo "Error: no se pudo conectar a PostgreSQL" >&2
    exit 1
  }
}
