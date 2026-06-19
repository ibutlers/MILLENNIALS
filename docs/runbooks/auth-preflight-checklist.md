# Checklist previo a la activación de Better Auth en producción

> Estado objetivo de este documento: preparar la activación definitiva. No autoriza cambios en producción sin plan explícito.

## Estado base actual (ventana temporal)

> **Actualizado 2026-06-19**: Producción NO está en modo seguro. Por decisión de Víctor (Kanban t_1245c893), se mantiene una ventana temporal controlada con auth/admin/email activos sobre IP/HTTP. Ver `docs/PENDIENTES.md` sección «Aceptación formal de riesgo» para caducidad, responsable y controles compensatorios.

- Producción en ventana temporal controlada:
  - Better Auth activo
  - SMTP activo
  - Admin activo
  - Override HTTP/IP activo
  - 2FA no obligatorio
- Better Auth está implementado, migrado, validado en E2E y **activo** para usuarios reales (1 admin).
- **No se debe editar `/srv/deployments/realstate/shared/.env` sin backup previo, plan exacto y confirmación explícita de Víctor.**
- El acceso al servidor debe hacerse solo con el alias SSH `jarvis-realstate`.

## No hacer sin plan explícito

- [ ] No desactivar auth/admin/SMTP sin plan de rollback a modo seguro documentado.
- [ ] No activar 2FA obligatorio sin segundo admin real y procedimiento de recuperación.
- [ ] No crear administradores reales con datos ficticios.
- [ ] No enviar correos reales sin SPF/DKIM/DMARC.
- [ ] No editar `.env` de producción sin backup previo.
- [ ] No tocar DNS.
- [ ] No cambiar Caddy/proxy.
- [ ] No borrar datos.
- [ ] No borrar backups.
- [ ] No ejecutar `docker compose down -v`.
- [ ] No borrar ni recrear `current_postgres-data` ni volúmenes `current_*`.
- [ ] No ejecutar `docker system prune -a`.

## Requisitos externos obligatorios

### Dominio y HTTPS

- [ ] Dominio definitivo decidido y apuntando a producción.
- [ ] HTTPS válido para el dominio definitivo.
- [ ] Renovación automática del certificado verificada.
- [ ] Redirección HTTP→HTTPS comprobada.
- [ ] `BETTER_AUTH_URL` definido con el dominio definitivo y HTTPS, por ejemplo `https://example.com`.
- [ ] `APP_BASE_URL` alineado con el dominio definitivo.
- [ ] Cookies de autenticación verificables como `Secure`, `HttpOnly` y `SameSite` bajo HTTPS.

### SMTP y entregabilidad

- [ ] Proveedor SMTP real contratado y operativo.
- [ ] `SMTP_HOST` definido.
- [ ] `SMTP_PORT` definido.
- [ ] `SMTP_SECURE` definido según el proveedor.
- [ ] `SMTP_USER` definido.
- [ ] `SMTP_PASSWORD` definido y almacenado solo en entorno seguro.
- [ ] `AUTH_EMAIL_FROM` definido con identidad real del club.
- [ ] `AUTH_EMAIL_REPLY_TO` definido y monitorizado.
- [ ] SPF configurado para el dominio remitente.
- [ ] DKIM configurado y validado.
- [ ] DMARC configurado al menos en modo monitorización inicial.
- [ ] Prueba de entrega a Gmail/Outlook/correo corporativo completada.
- [ ] Prueba de que los enlaces de verificación usan el dominio real.
- [ ] Logs revisados para confirmar que no contienen tokens ni secretos.

### Legal, privacidad y cookies

- [ ] Datos legales completos del responsable:
  - [ ] Razón social.
  - [ ] NIF/CIF.
  - [ ] Domicilio.
  - [ ] Email de contacto.
  - [ ] Datos registrales si aplican.
- [ ] Aviso legal definitivo publicado.
- [ ] Política de privacidad definitiva publicada.
- [ ] Política de cookies definitiva publicada.
- [ ] Cookies necesarias de autenticación documentadas.
- [ ] Textos de consentimiento revisados legalmente.
- [ ] Procedimiento humano de brecha/incidencia aprobado.

### Cuentas administrativas reales

- [ ] Identificados dos administradores reales como mínimo.
- [ ] Email corporativo o controlado para cada administrador.
- [ ] MFA/TOTP obligatorio para ambos.
- [ ] Procedimiento de recuperación de MFA preparado.
- [ ] Procedimiento de revocación de sesiones preparado.
- [ ] Procedimiento de auditoría de acciones admin preparado.

## Variables de producción que deben estar preparadas

No aplicar estos cambios hasta la ventana de activación definitiva (dominio + HTTPS + legal + 2 admins).

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

## Preflight técnico local antes de tocar producción

En `~/workspaces/realstate`:

```bash
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

Todos los comandos deben terminar con exit code `0` antes de plantear activación.

## Preflight en servidor en modo lectura

Usar siempre el alias SSH, nunca `user@ip`:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate \
  'hostname && cd /srv/workspaces/realstate && git fetch origin && git status --short && git rev-parse HEAD && git rev-parse origin/main && readlink -f /srv/deployments/realstate/current && cat /srv/deployments/realstate/current/REVISION'
```

Comprobar:

- [ ] Host correcto.
- [ ] Repo en `/srv/workspaces/realstate`.
- [ ] Rama `main`.
- [ ] Repo limpio.
- [ ] `HEAD` esperado.
- [ ] `origin/main` esperado.
- [ ] Release activa conocida.
- [ ] `REVISION` coincide con el despliegue esperado.
- [ ] Volumen `current_postgres-data` presente.
- [ ] Contenedores `current-*` activos.
- [ ] `/health` y `/api/health` devuelven OK.

## Criterios de aprobación antes de activar

- [ ] Dominio definitivo resuelto.
- [ ] HTTPS válido.
- [ ] SMTP real validado.
- [ ] SPF/DKIM/DMARC validados.
- [ ] Documentos legales publicados.
- [ ] Política de cookies publicada.
- [ ] Dos admins reales preparados.
- [ ] Backup previo planificado.
- [ ] Plan de rollback a modo seguro preparado.
- [ ] Ventana de activación acordada.
- [ ] Persona responsable disponible para validar correo real, MFA y acceso admin.
