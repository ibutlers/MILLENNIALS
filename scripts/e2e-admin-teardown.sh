#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Destruyendo entorno E2E aislado ==="
docker compose -f e2e/docker-compose.e2e.yml down -v --remove-orphans 2>/dev/null || true
echo "Entorno E2E destruido."
