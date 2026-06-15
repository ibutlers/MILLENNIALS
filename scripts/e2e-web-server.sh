#!/usr/bin/env bash
# Legacy wrapper: delegates to the unified e2e-setup.sh (Compose-based, SCRAM auth, no trust).
# Kept for backward compatibility; prefer using the Playwright configs directly via:
#   pnpm test:e2e         (public, playwright.config.ts)
#   pnpm test:e2e:admin   (admin, playwright.admin.config.ts)
set -euo pipefail
exec bash "$(dirname "${BASH_SOURCE[0]}")/e2e-setup.sh" "$@"
