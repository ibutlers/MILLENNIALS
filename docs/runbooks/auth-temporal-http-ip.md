# Runbook — postura temporal Auth/Admin sobre HTTP/IP

Fecha de inicio documentada: **2026-06-24**.
Fecha objetivo de retirada: **2026-07-08** o antes si dominio + HTTPS queda disponible.
Estado: **temporal aceptado por producto, no definitivo**.

## Resumen

Producción mantiene temporalmente autenticación, SMTP y panel admin activos sobre HTTP/IP mientras se completa dominio + HTTPS definitivo.

Postura temporal esperada:

- `AUTH_MODE=better-auth`
- `AUTH_EMAIL_MODE=smtp`
- `ADMIN_ENABLED=true`
- `AUTH_ALLOW_INSECURE_IP_TEST=true`
- `BETTER_AUTH_REQUIRE_2FA=false`
- `APP_BASE_URL` y `BETTER_AUTH_URL` apuntan temporalmente a HTTP/IP aprobado.
- `BETTER_AUTH_TRUSTED_ORIGINS` contiene el origen temporal aprobado.
- `SESSION_COOKIE_SECURE=false` solo mientras dure HTTP temporal.
- SMTP está configurado, pero sus valores nunca se imprimen.

MFA sigue opcional por decisión de producto. No activar MFA obligatorio sin nueva decisión explícita.

## Motivo de la activación temporal

- Permitir operación y validación real de Better Auth, SMTP, invitaciones, login y panel admin antes de cerrar DNS/HTTPS definitivo.
- Evitar SQL manual y flujos inseguros mientras se incorporan admins reales, recuperación de cuenta y documentación operativa.

## Riesgos aceptados temporalmente

- HTTP no cifra tráfico extremo a extremo; credenciales y cookies no deben considerarse protegidas frente a redes no confiables.
- `SESSION_COOKIE_SECURE=false` es necesario para la ventana HTTP, pero no es aceptable como postura final.
- `AUTH_ALLOW_INSECURE_IP_TEST=true` relaja la validación que normalmente bloquea auth/admin sin HTTPS.
- Dominio/HTTPS, SPF/DKIM/DMARC y segundo admin real siguen siendo tareas de cierre operativo.

## Alcance permitido durante la ventana

Permitido:

- Mantener auth/admin/SMTP activos para operación controlada.
- Ejecutar smokes y scripts read-only.
- Invitar usuarios reales mediante scripts oficiales sin imprimir tokens.
- Documentar y verificar caducidad.

No permitido sin autorización explícita:

- Editar `/srv/deployments/realstate/shared/.env`.
- Cambiar `AUTH_MODE`, `AUTH_EMAIL_MODE`, `ADMIN_ENABLED`, `AUTH_ALLOW_INSECURE_IP_TEST` o `BETTER_AUTH_REQUIRE_2FA`.
- Hacer rollback.
- Tocar `current_postgres-data`.
- Ejecutar `docker compose down -v` o `docker system prune -a`.
- Imprimir secretos, tokens, cookies, enlaces privados, contraseñas o valores SMTP.

## Smoke rápido read-only

En producción, desde `/srv/workspaces/realstate` o desde una release que contenga el script:

```bash
scripts/auth/check-temporary-http-ip.sh
```

El script no modifica DB, `.env`, contenedores, volúmenes ni flags.

Debe terminar con:

```text
RESULT=ok failures=0
```

Checks principales:

- `/health` -> 200 y cuerpo `ok`.
- `/api/health` -> 200 y PostgreSQL `ok`.
- `/api/config/public` -> `authEnabled=true`, `betterAuthRequire2FA=false`.
- `/acceso/login` -> 200.
- `/admin` -> 200.
- `/api/auth/get-session` sin cookie -> 200 y body `null`.
- `/api/auth/me` sin cookie -> 401.
- `/api/v1/admin/dashboard` sin cookie -> 401.
- Endpoints `/api/e2e/auth/*` -> 404.
- `current_postgres-data` presente.
- Flags temporales coherentes dentro del contenedor API, sin imprimir valores secretos.
- SMTP presente, sin imprimir host/user/password.

## Comprobación manual segura

Si el script no está disponible:

```bash
curl -fsS http://127.0.0.1:8088/health
curl -fsS http://127.0.0.1:8088/api/health
curl -fsS http://127.0.0.1:8088/api/config/public
curl -s -o /dev/null -w "login_page=%{http_code}\n" http://127.0.0.1:8088/acceso/login
curl -s -o /dev/null -w "admin_page=%{http_code}\n" http://127.0.0.1:8088/admin
curl -s -o /dev/null -w "auth_me_no_cookie=%{http_code}\n" http://127.0.0.1:8088/api/auth/me
curl -s -o /dev/null -w "admin_dashboard_no_cookie=%{http_code}\n" http://127.0.0.1:8088/api/v1/admin/dashboard
```

No usar `curl -i` en endpoints autenticados si puede imprimir cookies. Si se inspeccionan headers, contar atributos sin mostrar valores.

## Verificar que endpoints E2E no están expuestos

```bash
for path in \
  /api/e2e/auth/captured-emails \
  /api/e2e/auth/user-status \
  /api/e2e/auth/mfa-policy \
  /api/e2e/auth/invitation-token; do
  curl -s -o /dev/null -w "$path=%{http_code}\n" "http://127.0.0.1:8088$path"
done
```

Resultado esperado:

```text
404
```

en todos los endpoints.

## Comprobar SMTP sin imprimir valores

Solo comprobar presencia, nunca valores:

```bash
docker exec current-api-1 sh -lc '[ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_PORT:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASSWORD:-}" ]'
```

Si falla, revisar `.env` solo con autorización explícita y sin imprimir contenido.

## Comprobar admin

Sin sesión:

```bash
curl -s -o /dev/null -w "admin_page=%{http_code}\n" http://127.0.0.1:8088/admin
curl -s -o /dev/null -w "admin_dashboard_no_cookie=%{http_code}\n" http://127.0.0.1:8088/api/v1/admin/dashboard
```

Esperado:

- Página `/admin`: 200, porque el SPA carga.
- API dashboard sin cookie: 401.

Con sesión real, validar manualmente sin imprimir cookies ni tokens.

## Cómo volver a modo seguro

No ejecutar sin autorización explícita de Víctor.

Procedimiento esperado:

1. Crear backup de DB y de `/srv/deployments/realstate/shared/.env` sin imprimir valores.
2. Editar `.env` en servidor para desactivar la ventana temporal:
   - `AUTH_ALLOW_INSECURE_IP_TEST=false`.
   - Si no hay HTTPS definitivo, valorar también `ADMIN_ENABLED=false` o `AUTH_MODE=disabled` según decisión de producto.
3. Desplegar con:

```bash
./scripts/deploy.sh
```

4. Verificar `/health`, `/api/health`, rutas públicas y que admin/auth quedan en el modo decidido.
5. Si el deploy rompe salud crítica, usar `./scripts/rollback.sh` según runbook de rollback.

## Checklist para migrar a dominio + HTTPS

- [ ] Dominio definitivo apuntando al servidor.
- [ ] Caddy/Nginx sirviendo HTTPS válido.
- [ ] `APP_BASE_URL=https://<dominio>`.
- [ ] `BETTER_AUTH_URL=https://<dominio>`.
- [ ] `BETTER_AUTH_TRUSTED_ORIGINS` actualizado a HTTPS definitivo.
- [ ] `SESSION_COOKIE_SECURE=true`.
- [ ] `AUTH_ALLOW_INSECURE_IP_TEST=false`.
- [ ] `AUTH_MODE=better-auth` solo bajo HTTPS.
- [ ] `AUTH_EMAIL_MODE=smtp` con SPF/DKIM/DMARC revisados.
- [ ] `/health`, `/api/health`, `/api/config/public`, `/acceso/login`, `/admin` verificados bajo HTTPS.
- [ ] Cookies de sesión con `Secure`, `HttpOnly`, `SameSite` razonable.
- [ ] Endpoints HTTP/IP temporales no se usan para login real.

## Caducidad y alerta operativa

- Revisar esta ventana a diario mientras siga activa.
- Fecha objetivo de retirada: **2026-07-08**.
- Si en esa fecha sigue activo `AUTH_ALLOW_INSECURE_IP_TEST=true`, tratarlo como alerta operativa P1: priorizar dominio + HTTPS o volver a modo seguro.
- Ninguna automatización debe cambiar flags por sí sola; la retirada requiere decisión y deploy controlado.

## Evidencia mínima para cerrar la ventana temporal

La ventana temporal se considera cerrada solo cuando:

- `AUTH_ALLOW_INSECURE_IP_TEST=false` en producción.
- `APP_BASE_URL` y `BETTER_AUTH_URL` usan HTTPS definitivo.
- `SESSION_COOKIE_SECURE=true`.
- Smokes HTTPS pasan.
- No hay endpoints E2E expuestos.
- `current_postgres-data` se mantiene intacto.
- La release activa y `REVISION` quedan documentadas.
