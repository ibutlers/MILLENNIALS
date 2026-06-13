#!/usr/bin/env bash
set -euo pipefail
APP_NAME=realstate
DEPLOY_ROOT="/srv/deployments/${APP_NAME}"
CURRENT_LINK="${DEPLOY_ROOT}/current"
mapfile -t releases < <(find "${DEPLOY_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d | sort)
if (( ${#releases[@]} < 2 )); then echo "Need at least two releases to rollback" >&2; exit 1; fi
previous="${releases[$((${#releases[@]}-2))]}"
ln -sfn "$previous" "$CURRENT_LINK"
cd "$CURRENT_LINK"
docker compose up -d --build
./scripts/healthcheck.sh
