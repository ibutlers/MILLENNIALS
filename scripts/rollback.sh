#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="realstate"
DEPLOY_ROOT="/srv/deployments/${APP_NAME}"
SHARED_ENV="${DEPLOY_ROOT}/shared/.env"
CURRENT_LINK="${DEPLOY_ROOT}/current"
PREVIOUS_LINK="${DEPLOY_ROOT}/previous"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

read_env() {
  local key="$1"

  sed -n "s/^${key}=//p" "$SHARED_ENV" |
    head -n 1
}

for command in docker curl; do
  command -v "$command" >/dev/null 2>&1 ||
    fail "Falta el comando requerido: $command"
done

docker compose version >/dev/null 2>&1 ||
  fail "Docker Compose no está disponible"

[[ -f "$SHARED_ENV" ]] ||
  fail "No existe el archivo persistente $SHARED_ENV"

[[ -L "$CURRENT_LINK" ]] ||
  fail "No existe una release activa"

[[ -L "$PREVIOUS_LINK" ]] ||
  fail "No existe una release anterior"

CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
TARGET_RELEASE="$(readlink -f "$PREVIOUS_LINK")"

[[ -d "$CURRENT_RELEASE" ]] ||
  fail "La release activa no existe: $CURRENT_RELEASE"

[[ -d "$TARGET_RELEASE" ]] ||
  fail "La release anterior no existe: $TARGET_RELEASE"

[[ "$CURRENT_RELEASE" != "$TARGET_RELEASE" ]] ||
  fail "La release activa y la anterior son la misma"

CONFIGURED_PROJECT_NAME="$(read_env COMPOSE_PROJECT_NAME)"
if [[ -n "$CONFIGURED_PROJECT_NAME" && "$CONFIGURED_PROJECT_NAME" != "current" ]]; then
  fail "COMPOSE_PROJECT_NAME debe ser 'current' para preservar los volúmenes de producción"
fi
PROJECT_NAME="current"

HTTP_PORT="$(read_env REALSTATE_HTTP_PORT)"
HTTP_PORT="${HTTP_PORT:-8088}"

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

ln -sfn ../../shared/.env "$TARGET_RELEASE/.env"

# La release actual pasa a ser la alternativa de recuperación.
ln -sfn "$CURRENT_RELEASE" "$PREVIOUS_LINK"
ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"

echo "Activando release anterior: $TARGET_RELEASE"

if compose_release "$TARGET_RELEASE" \
    up -d --build --force-recreate &&
  REALSTATE_HTTP_PORT="$HTTP_PORT" \
    "$TARGET_RELEASE/scripts/healthcheck.sh"; then

  echo "Rollback completado correctamente"
  echo "Release activa: $TARGET_RELEASE"
  echo "Release alternativa: $CURRENT_RELEASE"
  exit 0
fi

echo "El rollback falló; restaurando la release original" >&2

ln -sfn "$TARGET_RELEASE" "$PREVIOUS_LINK"
ln -sfn "$CURRENT_RELEASE" "$CURRENT_LINK"
ln -sfn ../../shared/.env "$CURRENT_RELEASE/.env"

compose_release "$CURRENT_RELEASE" \
  up -d --build --force-recreate

REALSTATE_HTTP_PORT="$HTTP_PORT" \
  "$CURRENT_RELEASE/scripts/healthcheck.sh"

fail "No se pudo activar la release anterior"
