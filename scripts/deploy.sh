#!/usr/bin/env bash
set -euo pipefail
APP_NAME=realstate
SRC_DIR="/srv/workspaces/realstate"
DEPLOY_ROOT="/srv/deployments/${APP_NAME}"
BACKUP_ROOT="/srv/backups/${APP_NAME}"
LOG_ROOT="/var/log/${APP_NAME}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="${DEPLOY_ROOT}/releases/${TS}"
CURRENT_LINK="${DEPLOY_ROOT}/current"
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin is required" >&2; exit 1; }
mkdir -p "$DEPLOY_ROOT/releases" "$BACKUP_ROOT" "$LOG_ROOT"
if [[ -e "$CURRENT_LINK" ]]; then
  backup="${BACKUP_ROOT}/${TS}.tar.gz"
  tar -C "$(dirname "$(readlink -f "$CURRENT_LINK")")" -czf "$backup" "$(basename "$(readlink -f "$CURRENT_LINK")")"
  echo "backup created: $backup"
fi
mkdir -p "$RELEASE_DIR"
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude coverage --exclude playwright-report "$SRC_DIR/" "$RELEASE_DIR/"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
cd "$CURRENT_LINK"
docker compose up -d --build --force-recreate
./scripts/healthcheck.sh
