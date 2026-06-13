#!/usr/bin/env bash
set -euo pipefail
PORT="${REALSTATE_HTTP_PORT:-8088}"
URL="http://127.0.0.1:${PORT}/health"
body="$(curl -fsS "$URL")"
[[ "$body" == "ok" ]] || { echo "unexpected healthcheck body: $body" >&2; exit 1; }
echo "healthcheck ok: $URL"
