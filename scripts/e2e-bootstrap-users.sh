#!/usr/bin/env bash
# E2E user bootstrap — creates admin, operator, and investor users
# ONLY runs when E2E_TEST_MODE=true and NODE_ENV=test/e2e
set -euo pipefail

if [ "${E2E_TEST_MODE:-}" != "true" ] && [ "${NODE_ENV:-}" != "test" ] && [ "${NODE_ENV:-}" != "e2e" ]; then
  echo "ERROR: Este script solo puede ejecutarse en entorno E2E (E2E_TEST_MODE=true o NODE_ENV=test/e2e)."
  echo "  NODE_ENV actual: ${NODE_ENV:-'(no definido)'}"
  echo "  E2E_TEST_MODE actual: ${E2E_TEST_MODE:-'(no definido)'}"
  exit 1
fi

# Verify we're NOT in production
if [ -f /run/secrets/production ] || [ -f /srv/deployments/realstate/shared/.env ]; then
  echo "ERROR: Detectado entorno de producción. Abortando."
  exit 1
fi

echo "=== Creando usuarios E2E de prueba ==="

API_PORT="${1:-3000}"
API_URL="http://127.0.0.1:${API_PORT}"

# Wait for API to be ready
for i in $(seq 1 20); do
  if curl -s "${API_URL}/api/health" 2>/dev/null | grep -q '"ok"'; then
    break
  fi
  sleep 1
done

# Create users via the API auth endpoints (requires AUTH_ENABLED=true, REGISTRATION_ENABLED=true)
create_user() {
  local email="$1"
  local password="$2"
  local name="$3"
  
  local resp
  resp=$(curl -s -X POST "${API_URL}/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"name\":\"${name}\"}" 2>/dev/null)
  
  if echo "$resp" | grep -q '"id"'; then
    echo "  ✓ Usuario creado: ${email}"
    echo "$resp" | grep -o '"id":"[^"]*"' | head -1
  else
    echo "  ⚠ No se pudo crear ${email}: $(echo "$resp" | head -c 200)"
    return 1
  fi
}

# Create users (passwords are ephemeral, only for this E2E session)
create_user "admin@e2e.realstate.test" "AdminE2E-Pass123!" "Admin E2E" || true
create_user "operator@e2e.realstate.test" "OperatorE2E-Pass123!" "Operator E2E" || true
create_user "investor@e2e.realstate.test" "InvestorE2E-Pass123!" "Investor E2E" || true

# Assign roles via direct DB query (since there's no admin CLI in the E2E container)
echo "=== Asignando roles vía PostgreSQL ==="

# Find the container
CONTAINER=$(docker ps --filter "name=e2e" --filter "name=postgres" --format '{{.Names}}' | head -1)
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker compose -f e2e/docker-compose.e2e.yml ps -q postgres 2>/dev/null | head -1)
fi

if [ -n "$CONTAINER" ]; then
  docker exec "$CONTAINER" psql -U realstate_e2e -d realstate_e2e -q -t -c "
    INSERT INTO user_roles (user_id, role)
    SELECT u.id, 'admin' FROM users u WHERE u.email = 'admin@e2e.realstate.test'
    ON CONFLICT DO NOTHING;
    INSERT INTO user_roles (user_id, role)
    SELECT u.id, 'operator' FROM users u WHERE u.email = 'operator@e2e.realstate.test'
    ON CONFLICT DO NOTHING;
    INSERT INTO user_roles (user_id, role)
    SELECT u.id, 'investor' FROM users u WHERE u.email = 'investor@e2e.realstate.test'
    ON CONFLICT DO NOTHING;
  " 2>/dev/null && echo "  ✓ Roles asignados" || echo "  ⚠ No se pudieron asignar roles (los usuarios ya pueden tenerlos)"
else
  echo "  ⚠ Contenedor PostgreSQL no encontrado"
fi

echo "=== Bootstrap completado ==="
echo "Credenciales E2E (solo válidas para esta sesión):"
echo "  admin@e2e.realstate.test / AdminE2E-Pass123!"
echo "  operator@e2e.realstate.test / OperatorE2E-Pass123!"
echo "  investor@e2e.realstate.test / InvestorE2E-Pass123!"
