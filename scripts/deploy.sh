#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="realstate"
SRC_DIR="/srv/workspaces/realstate"
DEPLOY_ROOT="/srv/deployments/${APP_NAME}"
RELEASES_DIR="${DEPLOY_ROOT}/releases"
SHARED_DIR="${DEPLOY_ROOT}/shared"
SHARED_ENV="${SHARED_DIR}/.env"
CURRENT_LINK="${DEPLOY_ROOT}/current"
PREVIOUS_LINK="${DEPLOY_ROOT}/previous"
BACKUP_ROOT="/srv/backups/${APP_NAME}"
LOG_ROOT="/var/log/${APP_NAME}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

read_env() {
  local key="$1"

  sed -n "s/^${key}=//p" "$SHARED_ENV" |
    head -n 1
}

for command in git docker rsync curl; do
  command -v "$command" >/dev/null 2>&1 ||
    fail "Falta el comando requerido: $command"
done

docker compose version >/dev/null 2>&1 ||
  fail "Docker Compose no está disponible"

[[ -d "$SRC_DIR/.git" ]] ||
  fail "No existe un repositorio Git en $SRC_DIR"

[[ -f "$SHARED_ENV" ]] ||
  fail "No existe el archivo persistente $SHARED_ENV"

chmod 600 "$SHARED_ENV"

CONFIGURED_PROJECT_NAME="$(read_env COMPOSE_PROJECT_NAME)"
if [[ -n "$CONFIGURED_PROJECT_NAME" && "$CONFIGURED_PROJECT_NAME" != "current" ]]; then
  fail "COMPOSE_PROJECT_NAME debe ser 'current' para preservar los volúmenes de producción"
fi
PROJECT_NAME="current"

HTTP_PORT="$(read_env REALSTATE_HTTP_PORT)"
HTTP_PORT="${HTTP_PORT:-8088}"

DB_USER="$(read_env POSTGRES_USER)"
DB_NAME="$(read_env POSTGRES_DB)"

[[ "$(git -C "$SRC_DIR" branch --show-current)" == "main" ]] ||
  fail "El despliegue solo puede realizarse desde main"

[[ -z "$(git -C "$SRC_DIR" status --porcelain)" ]] ||
  fail "El repositorio contiene cambios sin commit"

git -C "$SRC_DIR" fetch origin main

[[ "$(git -C "$SRC_DIR" rev-parse HEAD)" == \
   "$(git -C "$SRC_DIR" rev-parse origin/main)" ]] ||
  fail "main local no coincide con origin/main"

mkdir -p \
  "$RELEASES_DIR" \
  "$SHARED_DIR" \
  "$BACKUP_ROOT" \
  "$LOG_ROOT"

CURRENT_RELEASE=""
if [[ -L "$CURRENT_LINK" ]]; then
  CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
fi

POSTGRES_CONTAINER="${PROJECT_NAME}-postgres-1"

if docker ps --format '{{.Names}}' |
  grep -qx "$POSTGRES_CONTAINER"; then

  [[ -n "$DB_USER" ]] ||
    fail "POSTGRES_USER no está configurado"

  [[ -n "$DB_NAME" ]] ||
    fail "POSTGRES_DB no está configurado"

  TEMP_BACKUP="${BACKUP_ROOT}/.database-${TIMESTAMP}.dump.tmp"
  FINAL_BACKUP="${BACKUP_ROOT}/database-${TIMESTAMP}.dump"

  docker exec "$POSTGRES_CONTAINER" \
    pg_dump \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -Fc > "$TEMP_BACKUP"

  mv "$TEMP_BACKUP" "$FINAL_BACKUP"
  chmod 600 "$FINAL_BACKUP"

  echo "Backup PostgreSQL creado: $FINAL_BACKUP"
fi

mkdir -p "$RELEASE_DIR"

rsync -a --delete \
  --exclude .git \
  --exclude .env \
  --exclude node_modules \
  --exclude dist \
  --exclude coverage \
  --exclude playwright-report \
  --exclude test-results \
  --exclude '*.backup' \
  --exclude '*.tmp' \
  "$SRC_DIR/" \
  "$RELEASE_DIR/"

ln -sfn ../../shared/.env "$RELEASE_DIR/.env"

compose_release() {
  local directory="$1"
  shift

  docker compose \
    --project-name "$PROJECT_NAME" \
    --env-file "$SHARED_ENV" \
    --project-directory "$directory" \
    -f "$directory/docker-compose.yml" \
    "$@"
}

compose_release "$RELEASE_DIR" config --quiet
compose_release "$RELEASE_DIR" build

if [[ -n "$CURRENT_RELEASE" && -d "$CURRENT_RELEASE" ]]; then
  ln -sfn "$CURRENT_RELEASE" "$PREVIOUS_LINK"
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Activando release: $RELEASE_DIR"

if compose_release "$RELEASE_DIR" up -d --force-recreate &&
  REALSTATE_HTTP_PORT="$HTTP_PORT" \
    "$RELEASE_DIR/scripts/healthcheck.sh"; then

  echo "Despliegue completado correctamente"
  echo "Release activa: $RELEASE_DIR"
  exit 0
fi

echo "El despliegue falló; iniciando rollback automático" >&2

if [[ -n "$CURRENT_RELEASE" && -d "$CURRENT_RELEASE" ]]; then
  ln -sfn ../../shared/.env "$CURRENT_RELEASE/.env"
  ln -sfn "$CURRENT_RELEASE" "$CURRENT_LINK"

  compose_release "$CURRENT_RELEASE" \
    up -d --build --force-recreate

  REALSTATE_HTTP_PORT="$HTTP_PORT" \
    "$CURRENT_RELEASE/scripts/healthcheck.sh"

  echo "Rollback completado: $CURRENT_RELEASE" >&2
else
  echo "No existe una release anterior para restaurar" >&2
fi

exit 1
