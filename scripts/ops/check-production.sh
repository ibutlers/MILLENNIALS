#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Uso: scripts/ops/check-production.sh [--help]

Agregador read-only de checks operativos Realstate. Orquesta los scripts
existentes sin duplicar lógica. No modifica .env, DB, contenedores, volúmenes,
flags ni backups. No imprime secretos, cookies, tokens ni enlaces privados.

Ejecuta, si existen y son ejecutables:
  - scripts/ops/smoke-production.sh
  - scripts/ops/check-auth-posture.sh
  - scripts/ops/check-backups.sh
  - scripts/ops/check-e2e-resources.sh
  - scripts/ops/check-logs.sh
  - scripts/auth/check-temporary-http-ip.sh

Resultado:
  RESULT=ok   si todos los checks ejecutados pasan
  RESULT=fail si algún check falla

Debe ejecutarse desde el repo o desde una release activa que contenga scripts/.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"

checks=(
  "scripts/ops/smoke-production.sh"
  "scripts/ops/check-auth-posture.sh"
  "scripts/ops/check-backups.sh"
  "scripts/ops/check-e2e-resources.sh"
  "scripts/ops/check-logs.sh"
  "scripts/auth/check-temporary-http-ip.sh"
)

executed=()
omitted=()
failed=()

printf '== Realstate production aggregate check ==\n'
printf 'repo_root=%s\n' "$repo_root"

for relative in "${checks[@]}"; do
  path="${repo_root}/${relative}"
  if [[ ! -e "$path" ]]; then
    printf 'SKIP %s no existe\n' "$relative"
    omitted+=("${relative}:missing")
    continue
  fi
  if [[ ! -x "$path" ]]; then
    printf 'SKIP %s no es ejecutable\n' "$relative"
    omitted+=("${relative}:not-executable")
    continue
  fi

  printf '\n== RUN %s ==\n' "$relative"
  executed+=("$relative")
  if "$path"; then
    printf 'PASS %s\n' "$relative"
  else
    printf 'FAIL %s\n' "$relative"
    failed+=("$relative")
  fi
done

printf '\n== Summary ==\n'
printf 'executed_count=%s\n' "${#executed[@]}"
for item in "${executed[@]}"; do
  printf 'executed=%s\n' "$item"
done

printf 'omitted_count=%s\n' "${#omitted[@]}"
for item in "${omitted[@]}"; do
  printf 'omitted=%s\n' "$item"
done

printf 'failed_count=%s\n' "${#failed[@]}"
for item in "${failed[@]}"; do
  printf 'failed=%s\n' "$item"
done

if [[ "${#failed[@]}" -ne 0 ]]; then
  printf 'RESULT=fail executed=%s omitted=%s failed=%s\n' "${#executed[@]}" "${#omitted[@]}" "${#failed[@]}"
  exit 1
fi

printf 'RESULT=ok executed=%s omitted=%s failed=0\n' "${#executed[@]}" "${#omitted[@]}"
exit 0
