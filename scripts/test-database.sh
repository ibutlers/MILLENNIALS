#!/usr/bin/env bash
# ── Canonical database test wrapper ──────────────────────────────────
# Entry point for all database migration/seed/SCRAM verification.
# Delegates to scripts/test-database.py for implementation.
#
# Safety: fails immediately if xtrace (set -x) is active, to prevent
# ephemeral credentials from appearing in stdout.
# ──────────────────────────────────────────────────────────────────────

# ── Anti-xtrace guard ────────────────────────────────────────────────
if [[ "${-}" == *x* ]]; then
  echo "ERROR: xtrace (set -x) activo. Ejecute 'set +x' antes de lanzar este script." >&2
  exit 1
fi
set +x 2>/dev/null || true

set -Eeuo pipefail

# ── Resolve repo root ────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Prerequisite checks ──────────────────────────────────────────────
for cmd in docker pnpm node python3; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' no encontrado en PATH" >&2
    exit 1
  fi
done

if [[ ! -f scripts/test-database.py ]]; then
  echo "ERROR: scripts/test-database.py no encontrado" >&2
  exit 1
fi

# ── Run canonical Python implementation ──────────────────────────────
exec python3 scripts/test-database.py
