# Runbook de activación futura de Better Auth en producción

> Este runbook describe cómo activar Better Auth cuando existan dominio, HTTPS, SMTP, configuración DNS de correo, textos legales y administradores reales. No debe ejecutarse todavía.

## Principios de seguridad

- No activar autenticación real sin confirmación explícita del plan.
- No activar administración real sin confirmación explícita del plan.
- No editar `/srv/deployments/realstate/shared/.env` sin backup previo y sin aprobación del cambio exacto.
- No ejecutar `docker compose down -v`, no borrar `current_postgres-data`, no borrar volúmenes `current_*` y no ejecutar `docker system prune -a`.
- Usar SSH solo con el alias `jarvis-realstate`.
- Todo cambio aprobado termina en commit, push y, solo si aplica a producción, deploy con `./scripts/deploy.sh`.

## Rutas de producción

- Repo de trabajo: `/srv/workspaces/realstate`
- Releases: `/srv/deployments/realstate/releases/`
- Release activa: `/srv/deployments/realstate/current`
- Variables compartidas: `/srv/deployments/realstate/shared/.env`
- Backups: `/srv/backups/realstate/`
- Base de datos persistente: volumen Docker `current_postgres-data`

## Precondiciones obligatorias

Completar `docs/runbooks/auth-preflight-checklist.md` antes de iniciar este runbook.

Resumen mínimo:

- [ ] Dominio definitivo operativo.
- [ ] HTTPS válido.
- [ ] `BETTER_AUTH_URL` definitivo con HTTPS.
- [ ] `AUTH_MODE=better-auth` planificado.
- [ ] `AUTH_EMAIL_MODE=smtp` planificado.
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` listos.
- [ ] `AUTH_EMAIL_FROM` y `AUTH_EMAIL_REPLY_TO` listos.
- [ ] SPF configurado.
- [ ] DKIM configurado.
- [ ] DMARC configurado.
- [ ] Datos legales completos.
- [ ] Política de privacidad definitiva.
- [ ] Aviso legal definitivo.
- [ ] Política de cookies actualizada con cookies necesarias de autenticación.
- [ ] Dos cuentas admin reales preparadas.
- [ ] Backup previo planificado.
- [ ] Plan de rollback a `AUTH_MODE=disabled` preparado.
- [ ] Prueba final con dominio real planificada.
- [ ] Prueba final con SMTP real planificada.
- [ ] Prueba final con MFA real planificada.

## Procedimiento de activación — no ejecutar todavía

### 1. Confirmar plan

Antes de tocar producción, confirmar por escrito:

- Ventana de activación.
- Commit exacto a desplegar.
- Release activa actual.
- Variables exactas a cambiar.
- Backup previo.
- Smoke tests post-activación.
- Responsable humano disponible para probar correo y MFA.
- Plan de rollback.

### 2. Validar localmente

En el Mac mini:

```bash
cd ~/workspaces/realstate
git status --short
git rev-parse HEAD
git rev-parse origin/main
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
./scripts/test-database.sh
pnpm test:e2e
pnpm test:e2e:admin
pnpm test:e2e:auth
pnpm test:e2e:investor
bash -n scripts/*.sh scripts/auth/*.sh
git diff --check
```

### 3. Verificar servidor en modo lectura

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'hostname && cd /srv/workspaces/realstate && git fetch origin && git status --short && git rev-parse HEAD && git rev-parse origin/main && readlink -f /srv/deployments/realstate/current && cat /srv/deployments/realstate/current/REVISION && docker ps --format "{{.Names}} {{.Status}}" | grep "^current-" && docker volume ls --format "{{.Name}}" | grep "^current_postgres-data$"'
```

No continuar si:

- El host no es el esperado.
- El repo no está limpio.
- La rama no es `main`.
- Falta el volumen `current_postgres-data`.
- Faltan contenedores `current-*`.
- La release activa no coincide con lo esperado.

### 4. Backup previo

El deploy script crea backup PostgreSQL si detecta el contenedor. Antes de editar `.env`, crear además backup del archivo de variables compartidas:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'set -e; ts=$(date -u +%Y%m%dT%H%M%SZ); cp -p /srv/deployments/realstate/shared/.env /srv/backups/realstate/shared-env-$ts.env; chmod 600 /srv/backups/realstate/shared-env-$ts.env; ls -l /srv/backups/realstate/shared-env-$ts.env'
```

No mostrar ni imprimir contenido de `.env`.

### 5. Cambios de variables de entorno

Editar `/srv/deployments/realstate/shared/.env` solo durante una ventana aprobada y después del backup.

Cambios esperados:

```env
AUTH_MODE=better-auth
AUTH_EMAIL_MODE=smtp
ADMIN_ENABLED=true
BETTER_AUTH_URL=https://DOMINIO_DEFINITIVO
APP_BASE_URL=https://DOMINIO_DEFINITIVO
SMTP_HOST=...
SMTP_PORT=...
SMTP_SECURE=...
SMTP_USER=...
SMTP_PASSWORD=...
AUTH_EMAIL_FROM=...
AUTH_EMAIL_REPLY_TO=...
```

Reglas:

- No imprimir secretos.
- No guardar copias en el repo.
- No usar valores ficticios.
- No activar si falta SPF/DKIM/DMARC.

### 5.1 Activación temporal sobre IP HTTP

El estado definitivo debe ser dominio + HTTPS. Solo para pruebas reales temporales sobre la IP actual se permite este override explícito:

```env
APP_BASE_URL=http://65.108.251.196:8088
BETTER_AUTH_URL=http://65.108.251.196:8088
BETTER_AUTH_TRUSTED_ORIGINS=http://65.108.251.196:8088
AUTH_ALLOW_INSECURE_IP_TEST=true
```

Reglas del override:

- Solo se acepta cuando `APP_BASE_URL` es exactamente `http://65.108.251.196:8088`.
- No permite HTTP para ningún otro host.
- Emite un warning de arranque sin secretos.
- Debe eliminarse al pasar a dominio + HTTPS.
- Mantener `SESSION_COOKIE_SECURE=false` únicamente durante esta prueba HTTP/IP; volver a `true` con HTTPS.

### 6. Actualizar servidor y desplegar

Solo después de push a GitHub y plan confirmado:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'cd /srv/workspaces/realstate && git fetch origin && git status --short && git rev-parse HEAD && git rev-parse origin/main'
```

Si el repo está limpio:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'cd /srv/workspaces/realstate && git pull --ff-only origin main'
```

Desplegar solo con el script oficial:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'cd /srv/workspaces/realstate && ./scripts/deploy.sh'
```

## Creación de los dos primeros administradores reales

### Reglas

- Nunca crear administradores por SQL manual directo salvo emergencia documentada.
- No usar datos ficticios.
- Crear al menos dos administradores reales antes de considerar producción operativa.
- Ambos administradores deben tener email real, email verificado, TOTP obligatorio y sesión probada.
- Toda asignación de rol admin debe quedar auditada.

### Procedimiento preferido

1. Crear invitación para el email real del primer administrador.
2. El administrador abre la invitación y crea contraseña.
3. Verifica email mediante enlace real recibido por SMTP.
4. Activa TOTP obligatorio.
5. Completa login con MFA.
6. Asignar rol `admin` server-side con herramienta operativa aprobada, no SQL directo.
7. Probar acceso al dashboard admin.
8. Probar logout.
9. Revocar una sesión y verificar que exige nueva sesión o nuevo login.
10. Revisar auditoría del alta, cambio de rol, login, logout y revocación.
11. Repetir con el segundo administrador real.
12. Verificar que ambos administradores pueden acceder y que al menos uno sigue operativo tras cerrar sesión del otro.

### Emergencia: pérdida de MFA

Si un administrador pierde MFA:

1. Confirmar identidad fuera de banda.
2. Registrar incidente interno con hora, persona solicitante y aprobador.
3. Verificar que existe un segundo admin operativo.
4. Revocar sesiones del admin afectado.
5. Restablecer MFA mediante herramienta operativa aprobada.
6. Obligar a reactivar TOTP.
7. Probar login + MFA.
8. Registrar auditoría y cierre del incidente.

No resolver pérdida de MFA editando tablas manualmente salvo emergencia mayor, documentada y aprobada.

## Smoke post-activación

Ejecutar tras deploy:

### Salud y configuración

- [ ] `GET /health` devuelve OK.
- [ ] `GET /api/health` devuelve OK y PostgreSQL OK.
- [ ] Config pública indica `AUTH_MODE` activo.
- [ ] `AUTH_EMAIL_MODE=smtp` activo en configuración operativa esperada.
- [ ] Logs no contienen secretos, tokens, cookies ni contraseñas.
- [ ] No hay endpoints E2E disponibles en producción.

### Login y administración

- [ ] `/acceso/login` carga con HTTPS.
- [ ] Crear invitación admin real.
- [ ] Email de invitación/verificación llega por SMTP real.
- [ ] Enlace de verificación usa dominio real HTTPS.
- [ ] Login admin + MFA funciona.
- [ ] Dashboard admin carga.
- [ ] Logout funciona.
- [ ] Revocar sesión funciona.
- [ ] Login tras revocación falla o exige nueva sesión.
- [ ] Cookies tienen `Secure`, `HttpOnly` y `SameSite` correctos.

### Autorización

- [ ] Investor sin permisos no ve proyectos privados.
- [ ] Investor no puede acceder a proyecto ajeno.
- [ ] Operator no puede ejecutar acciones exclusivas de admin.
- [ ] Admin sí puede ejecutar acciones admin permitidas.
- [ ] Endpoints admin sin sesión devuelven 401/403 según corresponda, no 404.

### Público

- [ ] `/acceso` sigue funcionando según el nuevo modo.
- [ ] Formularios públicos siguen operativos.
- [ ] Catálogo público sigue cargando.
- [ ] No se rompen páginas legales.

## Rollback a modo seguro

### Condiciones de rollback

Ejecutar rollback si ocurre cualquiera de estos casos:

- SMTP no entrega verificaciones.
- MFA no puede completarse.
- Admin real no puede entrar.
- Sesiones/cookies fallan con HTTPS.
- Logs exponen secretos o tokens.
- Errores 5xx en auth/admin.
- Cualquier comportamiento de autorización dudoso.

### Procedimiento

1. Confirmar motivo y hora del rollback.
2. Confirmar backup previo de `.env` y backup PostgreSQL del deploy.
3. Cambiar variables en `/srv/deployments/realstate/shared/.env`:

```env
AUTH_MODE=disabled
AUTH_EMAIL_MODE=disabled
ADMIN_ENABLED=false
```

4. Redeploy controlado con:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'cd /srv/workspaces/realstate && ./scripts/deploy.sh'
```

5. Verificar:

- [ ] `/api/auth/get-session` devuelve 503 o respuesta segura de auth desactivada.
- [ ] `/api/v1/admin/dashboard` devuelve 503.
- [ ] `/acceso` vuelve a estado informativo.
- [ ] Formularios públicos siguen operativos.
- [ ] Usuarios, invitaciones y tablas `auth.*` no se pierden.
- [ ] `current_postgres-data` sigue intacto.
- [ ] Release activa y `REVISION` registradas.
- [ ] Logs sin errores críticos.

6. Registrar:

- Hora UTC.
- Commit desplegado.
- Release activada.
- Motivo del rollback.
- Resultado de smoke posterior.
- Próximo intento o bloqueo.

## Registro de activación

Cuando se ejecute en el futuro, completar:

- Fecha/hora UTC:
- Commit:
- Release previa:
- Release nueva:
- Backup `.env`:
- Backup PostgreSQL:
- Dominio:
- Proveedor SMTP:
- Admin 1 verificado:
- Admin 2 verificado:
- Resultado smoke:
- Incidencias:
- Decisión final:
