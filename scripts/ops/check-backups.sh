#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/srv/backups/realstate}"
MIN_DB_BACKUPS="${MIN_DB_BACKUPS:-3}"
MAX_DB_AGE_HOURS="${MAX_DB_AGE_HOURS:-48}"
MIN_ENV_BACKUPS="${MIN_ENV_BACKUPS:-1}"
MAX_ENV_AGE_HOURS="${MAX_ENV_AGE_HOURS:-168}"

usage() {
  cat <<'EOF'
Uso: scripts/ops/check-backups.sh [--help]

Auditoría read-only de backups Realstate. No crea, restaura, borra ni copia
backups. No imprime valores de .env ni secretos; solo metadatos sanitizados.

Variables opcionales:
  BACKUP_ROOT          Directorio de backups (default: /srv/backups/realstate)
  MIN_DB_BACKUPS       Mínimo de dumps DB esperados (default: 3)
  MAX_DB_AGE_HOURS     Edad máxima del dump DB más reciente (default: 48)
  MIN_ENV_BACKUPS      Mínimo de backups .env esperados (default: 1)
  MAX_ENV_AGE_HOURS    Edad máxima recomendada del backup .env más reciente (default: 168)

Checks:
  - directorio de backups existe
  - mínimo de backups DB y .env
  - edades/tamaños/permisos de backups recientes
  - último dump DB es legible con pg_restore --list si pg_restore está disponible
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

export BACKUP_ROOT MIN_DB_BACKUPS MAX_DB_AGE_HOURS MIN_ENV_BACKUPS MAX_ENV_AGE_HOURS
python3 - <<'PY'
import os
import stat
import subprocess
import sys
import time
from pathlib import Path

backup_root = Path(os.environ["BACKUP_ROOT"])
min_db = int(os.environ["MIN_DB_BACKUPS"])
max_db_age = float(os.environ["MAX_DB_AGE_HOURS"])
min_env = int(os.environ["MIN_ENV_BACKUPS"])
max_env_age = float(os.environ["MAX_ENV_AGE_HOURS"])
now = time.time()
failures = 0
warnings = 0

def ok(message: str) -> None:
    print(f"OK {message}")

def warn(message: str) -> None:
    global warnings
    warnings += 1
    print(f"WARN {message}")

def fail(message: str) -> None:
    global failures
    failures += 1
    print(f"FAIL {message}")

def kind_for(path: Path) -> str:
    name = path.name.lower()
    if "env" in name and path.suffix == ".env":
        return "env"
    if "env" in name and "shared-env" in name:
        return "env"
    if path.suffix == ".dump" or "database" in name:
        return "db"
    return "other"

def describe(path: Path) -> dict:
    st = path.stat()
    return {
        "name": path.name,
        "kind": kind_for(path),
        "size": st.st_size,
        "mtime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime)),
        "age_hours": round((now - st.st_mtime) / 3600, 1),
        "mode": oct(stat.S_IMODE(st.st_mode)),
    }

print("== Realstate backup check ==")
print(f"backup_root={backup_root}")

if not backup_root.exists() or not backup_root.is_dir():
    fail("directorio de backups no existe")
    print(f"RESULT=fail failures={failures} warnings={warnings}")
    sys.exit(1)

items = [describe(p) for p in backup_root.iterdir() if p.is_file()]
items.sort(key=lambda x: x["mtime"], reverse=True)
db_items = [x for x in items if x["kind"] == "db"]
env_items = [x for x in items if x["kind"] == "env"]

print(f"INFO total_files={len(items)} db_backups={len(db_items)} env_backups={len(env_items)}")
print("INFO latest_sanitized:")
for item in items[:10]:
    print(f"  - name={item['name']} kind={item['kind']} size={item['size']} mtime={item['mtime']} age_hours={item['age_hours']} mode={item['mode']}")

if len(db_items) >= min_db:
    ok(f"backups DB >= {min_db}")
else:
    fail(f"backups DB insuficientes: {len(db_items)} < {min_db}")

if db_items:
    latest_db = db_items[0]
    if latest_db["age_hours"] <= max_db_age:
        ok(f"último backup DB reciente: {latest_db['age_hours']}h <= {max_db_age}h")
    else:
        fail(f"último backup DB demasiado antiguo: {latest_db['age_hours']}h > {max_db_age}h")
    if latest_db["size"] > 0:
        ok("último backup DB tiene tamaño > 0")
    else:
        fail("último backup DB tiene tamaño 0")
    mode = int(latest_db["mode"], 8)
    if mode & 0o077 == 0:
        ok("permisos del último backup DB no son world/group-readable")
    else:
        fail(f"permisos demasiado abiertos en backup DB: {latest_db['mode']}")

    if subprocess.run(["bash", "-lc", "command -v pg_restore >/dev/null 2>&1"]).returncode == 0:
        latest_path = str(backup_root / latest_db["name"])
        result = subprocess.run(["pg_restore", "--list", latest_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            ok("último backup DB legible con pg_restore --list")
        else:
            fail("último backup DB no es legible con pg_restore --list")
    else:
        warn("pg_restore no disponible; se omite validación estructural del dump")
else:
    fail("no hay backups DB")

if len(env_items) >= min_env:
    ok(f"backups .env >= {min_env}")
else:
    fail(f"backups .env insuficientes: {len(env_items)} < {min_env}")

if env_items:
    latest_env = env_items[0]
    if latest_env["age_hours"] <= max_env_age:
        ok(f"último backup .env dentro de ventana recomendada: {latest_env['age_hours']}h <= {max_env_age}h")
    else:
        warn(f"último backup .env antiguo: {latest_env['age_hours']}h > {max_env_age}h; crear backup antes de editar .env")
    if latest_env["size"] > 0:
        ok("último backup .env tiene tamaño > 0")
    else:
        fail("último backup .env tiene tamaño 0")
    mode = int(latest_env["mode"], 8)
    if mode & 0o077 == 0:
        ok("permisos del último backup .env no son world/group-readable")
    else:
        fail(f"permisos demasiado abiertos en backup .env: {latest_env['mode']}")

if failures:
    print(f"RESULT=fail failures={failures} warnings={warnings}")
    sys.exit(1)
print(f"RESULT=ok failures=0 warnings={warnings}")
PY
