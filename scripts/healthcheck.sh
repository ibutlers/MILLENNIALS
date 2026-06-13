#!/usr/bin/env bash
set -euo pipefail
PORT="${REALSTATE_HTTP_PORT:-8088}"
URL="http://127.0.0.1:${PORT}/health"
ATTEMPTS="${REALSTATE_HEALTHCHECK_ATTEMPTS:-30}"
SLEEP_SECONDS="${REALSTATE_HEALTHCHECK_SLEEP:-2}"
last_error=""
for attempt in $(seq 1 "$ATTEMPTS"); do
  if body="$(curl -fsS "$URL" 2>&1)"; then
    if [[ "$body" == "ok" ]]; then
      echo "healthcheck ok: $URL"
      exit 0
    fi
    last_error="unexpected body: $body"
  else
    last_error="$body"
  fi
  if [[ "$attempt" != "$ATTEMPTS" ]]; then
    sleep "$SLEEP_SECONDS"
  fi
done
echo "healthcheck failed after ${ATTEMPTS} attempts for $URL: $last_error" >&2
exit 1
