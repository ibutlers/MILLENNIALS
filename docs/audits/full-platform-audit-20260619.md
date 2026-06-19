# Auditoría integral Realstate — 2026-06-19

## 1. Resumen ejecutivo

Realstate está desplegado y responde correctamente a nivel técnico: producción devuelve `ok` en `/health`, PostgreSQL responde `ok` en `/api/health`, los contenedores `current-*` están arriba y el volumen `current_postgres-data` existe. El repo remoto de producción está limpio y `HEAD = origin/main = REVISION`.

El hallazgo principal es operativo/de seguridad: producción tiene Better Auth, SMTP, admin y el override temporal HTTP/IP activos sobre `http://65.108.251.196:8088`, con 2FA no requerido. Esto contradice `docs/PENDIENTES.md`, que aún documenta producción en modo seguro (`AUTH_MODE=disabled`, `AUTH_EMAIL_MODE=disabled`, `ADMIN_ENABLED=false`) y lista dominio/HTTPS/SMTP/legal/dos admins reales como pendientes externos antes de activar auth/admin real. Mientras esta activación temporal siga activa, debe tratarse como P0: o se confirma explícitamente como ventana temporal controlada, o se vuelve a modo seguro.

A nivel producto, la landing pública, proyectos públicos, detalle, contacto y coinversión están bastante completos. El área inversor existe y tiene base real, pero documentos, recuperación, sesiones, KYC/verificación y seguridad son parciales. El admin tiene UI y backend amplios, pero hay riesgos concretos en invitaciones, documentos privados, roles `staff/operator`, auditoría de actor y experiencia frontend de RBAC/MFA.

No se han hecho cambios de código ni producción en esta auditoría. Este documento y el backlog Kanban son el entregable del bloque.

## 2. Estado real de producción

Inspección read-only vía `ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate`:

- Release activa: `/srv/deployments/realstate/releases/20260619T123443Z`.
- `REVISION`: `619239a905ac4412b86e90399d539d1d55952657`.
- `/health`: `ok`.
- `/api/health`: `{"status":"ok","service":"api","dependencies":{"postgres":"ok"}}`.
- Contenedores activos: `current-proxy-1`, `current-api-1`, `current-postgres-1`, `current-frontend-1`.
- Volumen de producción: `current_postgres-data` presente.
- Puerto publicado: `0.0.0.0:8088->80/tcp` en `current-proxy-1`.
- Recursos E2E residuales en producción: no se detectaron contenedores, volúmenes ni redes con patrón `realstate-e2e|e2e`.
- Backups recientes: sí; hay backups en `/srv/backups/realstate`, incluyendo backups del 2026-06-19.
- Endpoints E2E en producción: `/api/v1/e2e/health`, `/api/v1/e2e/emails`, `/api/v1/e2e/totp` devuelven 404.

Estado público observado:

- `/api/auth/status`: Better Auth disponible.
- `/api/config/public`: `authEnabled=true`, `betterAuthRequire2FA=false`.
- `/admin`: HTTP 200 sobre IP/HTTP.
- `/acceso/login`: HTTP 200 sobre IP/HTTP.

## 3. Estado Git/release

### Local Mac

- Directorio: `/Users/victormacmini/workspaces/realstate`.
- Rama: `main`.
- Antes del pull local: `HEAD=389ceef26a4810552967ce20a218c0c5c23f5169`, `origin/main=619239a905ac4412b86e90399d539d1d55952657`.
- Se ejecutó `git pull --ff-only origin main` para alinear la auditoría con producción.
- Después del pull: `HEAD=origin/main=619239a905ac4412b86e90399d539d1d55952657`.
- Estado local antes de escribir este documento: limpio.
- Docker local/Colima no estaba activo; no se pudo inspeccionar recursos E2E locales por Docker.

### Producción

- Rama: `main`.
- `HEAD=619239a905ac4412b86e90399d539d1d55952657`.
- `origin/main=619239a905ac4412b86e90399d539d1d55952657`.
- `REVISION=619239a905ac4412b86e90399d539d1d55952657`.
- `HEAD = origin/main = REVISION`: sí.
- Cambios locales en producción: ninguno.

## 4. Estado auth/admin

Estado efectivo de producción:

- Better Auth: activo.
- Email auth: SMTP activo.
- Admin: activo.
- Override temporal HTTP/IP: activo.
- 2FA obligatorio: no; `betterAuthRequire2FA=false` en configuración pública.
- SMTP: configurado según presencia de variables y modo activo; no se imprimieron secretos.
- Admins reales en DB: 1 usuario `admin` activo.
- Invitaciones en DB: 1 aceptada, 1 revocada.
- Auth users en DB: 1.
- `app_users`: 1 total, `active:1`, `admin:1`.

Riesgo operativo: solo existe un admin activo; falta segundo admin real y procedimiento probado de recuperación MFA/sesiones.

Riesgo de activación temporal: producción está sobre HTTP/IP sin dominio/HTTPS definitivo. Si esta ventana temporal no está aprobada explícitamente, el rollback mínimo recomendado es volver a modo seguro con backup previo de `.env` y verificación posterior:

```text
AUTH_MODE=disabled
AUTH_EMAIL_MODE=disabled
ADMIN_ENABLED=false
```

No se aplicó rollback ni se editó `.env` porque la tarea pedía auditoría/plan y no autoriza cambios de producción salvo P0 obvio. La producción está viva; el problema es de postura de seguridad/configuración temporal.

## 5. Estado frontend

### Completo o razonablemente completo

- Landing pública SPA con navegación por hash y menú responsive.
- Proyectos públicos, catálogo y detalle.
- Formulario contacto y formulario coinversión con validación cliente, honeypot, success/error.
- `/acceso` como entrada de acceso/solicitud.
- Área inversor base: dashboard, perfil, cartera, documentos, verificación, oportunidades, cuenta y seguridad.
- Admin UI amplia: dashboard, oportunidades, leads, solicitudes de inversión, usuarios y auditoría.
- Tests web unitarios ejecutados por auditoría frontend: `pnpm --filter @realstate/web typecheck` OK y `pnpm --filter @realstate/web test` OK con 12 archivos / 48 tests.

### Parcial o inconsistente

- Login/MFA: `LoginPage` y `AuthProvider.login()` no distinguen claramente setup TOTP vs challenge TOTP en login. `/acceso/2fa` parece orientado a activar TOTP, no a resolver challenge para usuario ya enrolado.
- Admin SPA: backend es la fuente de verdad, pero la UI puede renderizar shell/nav admin a usuario autenticado sin rol admin/operator y depender de errores API posteriores.
- Cliente auth legacy mezclado con Better Auth: `auth/client.ts`, recovery/reset/sesiones y algunas páginas siguen usando `/api/v1/auth/*` mientras la sesión principal usa `/api/auth/*`.
- Manejo 401/403/500 no está centralizado; varias vistas muestran mensajes genéricos.
- Área inversor contiene estados vacíos honestos, pero documentos, KYC/verificación, gestión de sesiones y seguridad avanzada no son operativos de verdad.

## 6. Estado backend

### Fortalezas

- Fastify con Zod y contratos compartidos.
- Better Auth v1.6.19 aislado en schema `auth` con migraciones correctivas hasta `0013`.
- Modelo local `app_users`, `project_user_access`, `access_invitations`.
- Middleware de sesión, estado local, email verified, MFA y roles.
- Admin gate y RBAC backend.
- Endpoints públicos, admin e inversor definidos.
- Rate limiting y validación de configuración insegura.

### Hallazgos principales

1. Invitaciones no entregan token de activación en el email:
   - `InvitationRepository.create()` devuelve token, pero `invitation-routes.ts` lo descarta.
   - `sendInvitation(email, invitation.publicReference)` acaba generando `${baseUrl}/acceso` sin token si recibe una referencia.
   - El signup Better Auth exige `X-Invitation-Token`; por tanto el flujo real de invitación puede quedar bloqueado.

2. Documentos privados:
   - `GET /api/investor/projects/:id/documents` consulta `private_documents`.
   - En producción `to_regclass('public.private_documents')` devuelve `missing`; existe `documents` y está vacía.

3. Roles `staff/operator`:
   - DB enum `app_user_role` contiene `investor | staff | admin`.
   - Frontend/contratos/admin usan `operator` en varios puntos.
   - Middleware traduce `staff` a `operator`, pero actualizaciones con cast a enum pueden fallar si llega `operator`.

4. Auditoría/actor admin:
   - `admin/auth.ts` setea `_authUser`, pero algunas rutas leen `appUser`.
   - Varias inserciones de `audit_events` usan `user_id=null`, reduciendo trazabilidad.

5. MFA/config:
   - Algunos checks consultan `process.env.BETTER_AUTH_REQUIRE_2FA` directamente en lugar de la config inyectada.

## 7. Estado base de datos

- Migraciones reales: 17 (`0001` a `0017`).
- Producción `schema_migrations=17`.
- `0001_baseline_definitive.sql` permanece como baseline inmutable.
- Datos auth/app en producción:
  - `auth_users=1`.
  - `app_users_total=1`.
  - `active_admins=1`.
  - invitaciones: `accepted:1`, `revoked:1`.
  - `documents_count=0`.
  - `private_documents`: tabla ausente.
- No se ejecutó `./scripts/test-database.sh` durante esta auditoría porque no es necesario para documentación/plan y el entorno Docker local no estaba activo; debe ejecutarse antes de certificar cualquier cambio de DB/auth.

## 8. Estado DevOps

### Fortalezas

- `deploy.sh` exige repo limpio, rama `main`, sincronía con `origin/main`, `COMPOSE_PROJECT_NAME=current`, backup previo y healthcheck.
- `rollback.sh` existe y usa `current`/`previous`.
- Producción preserva `current_postgres-data`.
- Caddy/Compose levantan proxy, frontend, API y PostgreSQL.
- Healthchecks activos.
- Backups recientes disponibles.

### Riesgos

- Producción activa auth/admin sobre HTTP/IP; requiere decisión inmediata.
- Dockerfiles usan `pnpm install --frozen-lockfile=false`, no completamente reproducible.
- `docker-compose.yml` contiene defaults débiles si faltan variables críticas; conviene usar `${VAR:?required}` para secretos/runtime productivo.
- No hay evidencia automatizada en repo de restore drill periódico ni política de retención de backups.
- `deploy.sh` ejecuta seed en cada deploy; depende de `DEMO_SEED_ENABLED=false` y de idempotencia.

## 9. Estado QA

- `pnpm audit --audit-level=low`: OK, sin vulnerabilidades conocidas.
- Grep de seguridad/deuda produjo 342 coincidencias; clasificadas como:
  - `.env.example` con placeholders, no secreto real.
  - muchos `as any`, principalmente tests y algunas rutas admin/auth que deberían reducirse gradualmente.
  - `console.log/error` en CLI/scripts de auth, esperado pero debe seguir sin imprimir tokens/secretos.
  - tests que esperan 500 en rutas de error controladas; revisar que no acepten 500 como éxito funcional.
  - no se detectaron `.only` ni `.skip` en tests.
- Archivos de test reales detectados por git: 40 incluyendo unit/integration/e2e/specs; `docs/testing.md` está desactualizado.
- No se ejecutó la batería completa en este bloque porque la tarea prioriza auditoría/plan y algunos tests/builds generan artefactos (`dist/`) o requieren Docker local activo. Para certificar operación real faltan:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `./scripts/test-database.sh`
  - `pnpm test:e2e`
  - `pnpm test:e2e:admin`
  - `pnpm test:e2e:auth`
  - `pnpm test:e2e:investor`

## 10. Estado seguridad

### Positivo

- No se imprimieron secretos ni tokens durante la auditoría.
- `/srv/deployments/realstate/shared/.env` no se editó.
- Endpoints E2E no expuestos en producción según smoke HTTP.
- `pnpm audit` sin vulnerabilidades conocidas.
- CORS/origin y rate limiting existen.
- Auth startup rechaza configuraciones inseguras salvo override temporal explícito.
- Cookies y Better Auth están centralizados, aunque deben verificarse bajo HTTPS definitivo.

### Riesgos

- P0: auth/admin activos sobre HTTP/IP sin HTTPS definitivo y con 2FA no requerido.
- P0/P1: solo un admin real activo.
- P1: invitaciones sin token rompen o desvían el flujo esperado y empujan a soluciones manuales peligrosas.
- P1: documentos privados apuntan a tabla ausente; riesgo de 500 en ruta privada.
- P1: roles inconsistentes pueden romper RBAC/admin.
- P1: CSRF/origin permite ausencia de Origin en algunas rutas; revisar defensa para APIs cookie-based.
- P1: rate limit Better Auth en memoria; insuficiente si escala multi-instancia.
- P1: falta comprobación de restore real de backups.

## 11. Estado documentación/legal

### Desactualizado

- `docs/PENDIENTES.md` dice que producción está en modo seguro (`AUTH_MODE=disabled`, `AUTH_EMAIL_MODE=disabled`, `ADMIN_ENABLED=false`), pero producción efectiva tiene auth/email/admin activos.
- `docs/PENDIENTES.md` dice `test-database` validado con 13 migraciones; hay 17 migraciones reales.
- `docs/testing.md` declara 14 archivos / 88 tests; git detecta 40 archivos de test/spec.

### Pendiente técnico

- Corregir invitaciones con token.
- Corregir documentos privados.
- Unificar `staff/operator`.
- Mejorar auditoría con actor real.
- Centralizar errores frontend 401/403/500.
- Certificar suites completas.

### Pendiente externo

- Dominio definitivo.
- HTTPS válido.
- SMTP definitivo y remitente operativo.
- SPF, DKIM y DMARC.
- Segundo admin real.

### Pendiente legal

- Razón social, NIF/CIF, domicilio, correo legal/contacto y datos registrales si aplican.
- Aviso legal definitivo.
- Privacidad definitiva.
- Cookies definitiva.
- Consentimientos revisados.
- Procedimiento humano de brecha/incidencia.

### Pendiente operativo

- Confirmar o revertir activación temporal HTTP/IP.
- Runbook de rollback probado.
- Restore drill de backups.
- Monitorización básica.
- Rotación y recuperación de MFA/admin.

### Pendiente producto

- Área inversor real: documentos, KYC/verificación, sesiones, seguridad.
- Admin operativo con UX de permisos clara.
- Emails transaccionales completos y probados.
- Copy de acceso acorde al estado real de auth/admin.

## 12. Riesgos críticos

1. Auth/admin activos sobre HTTP/IP con override temporal y sin 2FA obligatorio.
2. Flujo de invitación probablemente no entrega token de activación, bloqueando alta real segura.
3. Endpoint privado de documentos consulta tabla inexistente `private_documents`.
4. Documentación operativa afirma modo seguro cuando producción efectiva está activa.

## 13. Riesgos altos

1. Solo un admin activo en producción.
2. Roles `staff/operator` inconsistentes entre DB, API y UI.
3. Auditoría admin con actor `null` o contexto incorrecto en acciones críticas.
4. Login/MFA frontend no distingue claramente setup vs challenge.
5. Admin SPA puede mostrar shell a usuario no autorizado antes de que backend bloquee.
6. Recovery/reset/sesiones frontend usan endpoints legacy mezclados con Better Auth.
7. Backups sin restore drill documentado/automatizado.
8. Docker build no totalmente reproducible.

## 14. Riesgos medios

1. Manejo 401/403/500 no centralizado en frontend.
2. Accesibilidad de formularios admin/inversor mejorable.
3. Rate limiting Better Auth en memoria.
4. `auth.user.email` con unicidad case-sensitive.
5. Docs de QA y migraciones desactualizadas.
6. Smoke inversor potencialmente desalineado con MFA real.

## 15. Riesgos bajos

1. Duplicidades o deuda de componentes admin.
2. Feedback de mutaciones admin mejorable.
3. Alias `/inversor` vs `/inversores` incompleto.
4. Limpieza progresiva de `as any` en tests/rutas.
5. Observabilidad mínima sin métricas/alertas externas.

## 16. Qué falta para operar de verdad

- Confirmar postura de producción: mantener temporal HTTP/IP con caducidad o volver a modo seguro.
- Dominio + HTTPS.
- SMTP definitivo validado end-to-end.
- SPF/DKIM/DMARC.
- Segundo admin real.
- Invitación → signup → email verification → MFA → active probado con email real.
- Admin e inversor con permisos reales y E2E verdes.
- Documentos privados funcionales.
- Backup/restore probado.
- Monitorización/alertas básicas.
- Legal completo.

## 17. Qué falta para activar auth/admin de forma definitiva

1. Dominio definitivo apuntando a producción.
2. HTTPS activo y verificado.
3. `AUTH_ALLOW_INSECURE_IP_TEST=false` o ausente.
4. `AUTH_MODE=better-auth` solo bajo HTTPS.
5. `AUTH_EMAIL_MODE=smtp` con SMTP real, SPF/DKIM/DMARC.
6. `BETTER_AUTH_REQUIRE_2FA=true` salvo decisión temporal explícita documentada.
7. Dos admins reales activos.
8. Recuperación MFA/admin documentada y probada.
9. E2E auth/admin/inversor verdes.
10. Legal publicado.
11. Runbook rollback probado.

## 18. Qué se puede hacer rápido

- Corregir docs desactualizados (`PENDIENTES.md`, `testing.md`).
- Crear tarea P0 para decidir/revertir auth temporal.
- Corregir email de invitación para usar token sin imprimirlo.
- Cambiar documentos privados a tabla `documents` o crear migración clara.
- Añadir guard UX en admin SPA para no mostrar shell a inversores.
- Añadir smoke de endpoints E2E 404 en producción.
- Añadir restore drill documentado.

## 19. Qué no debe hacerse todavía

- No hacer deploy por esta auditoría documental.
- No editar `.env` de producción sin backup y plan confirmado.
- No borrar/recrear `current_postgres-data` ni volúmenes `current_*`.
- No activar definitivamente auth/admin sin dominio/HTTPS/legal/segundo admin.
- No crear admins ficticios.
- No tocar datos reales salvo inspección read-only o acción aprobada.
- No implementar todo el backlog de golpe sin resolver P0 y ordenar dependencias.

## 20. Mapa de flujos

### Flujo público

- Estado: mayormente completo.
- Cubre landing, proyectos públicos, detalle, contacto, coinversión.
- Falta: smoke visual sistemático y actualización de docs/tests a estado real.

### Flujo inversor

- Estado: parcial.
- Existe dashboard, proyectos, cartera, solicitudes e interfaces de documentos/verificación/seguridad.
- Falta: documentos privados reales, KYC/verificación real, sesiones reales, permisos por proyecto probados end-to-end.

### Flujo admin

- Estado: parcial/alto potencial.
- Existe panel, endpoints, RBAC backend, leads, oportunidades, usuarios, auditoría.
- Falta: UX RBAC, actor/auditoría, roles consistentes, segundo admin, E2E completo bajo producción-like auth.

### Flujo operator

- Estado: parcial.
- Backend traduce `staff` a `operator`, pero DB y contratos no están unificados.
- Falta: decisión nomenclatura, pruebas de permisos y UI específica.

### Flujo invitación

- Estado: incompleto/P0.
- Repositorio crea token y validate soporta token-only, pero email recibe referencia pública sin token.
- Falta: URL de activación con token, tests y E2E real.

### Flujo recuperación

- Estado: parcial.
- Better Auth tiene `sendResetPassword`; frontend mezcla legacy.
- Falta: UI y E2E de reset Better Auth, revocación de sesiones y mensajes anti-enumeración.

### Flujo rollback

- Estado: documentado y script presente.
- Falta: drill reciente específico de auth/admin y verificación de restore/backups.

## 21. Plan Kanban

> Board: `realstate`. Orquestador: `realstate`. Perfiles disponibles confirmados: `realstatebackend`, `realstatefrontend`, `realstateqa`, `realstatereviewer`, `realstatedevops`.

### P0 — Seguridad/producción

#### Título: Decidir y corregir postura auth/admin temporal HTTP/IP
Perfil: realstatedevops
Prioridad: P0
Tipo: devops/security
Contexto: Producción tiene Better Auth, SMTP, admin y override HTTP/IP activos sobre IP/HTTP; 2FA no requerido. Docs dicen modo seguro.
Objetivo: Confirmar si la ventana temporal sigue aprobada o preparar rollback mínimo a modo seguro.
Archivos probables: `docs/runbooks/auth-production-activation.md`, `docs/PENDIENTES.md`, `/srv/deployments/realstate/shared/.env` solo con backup y aprobación.
Pasos: Verificar flags efectivos sin secretos; documentar riesgo; si Víctor confirma rollback, backup `.env` y DB, aplicar `AUTH_MODE=disabled`, `AUTH_EMAIL_MODE=disabled`, `ADMIN_ENABLED=false`, quitar override; smoke.
Validación: `/health`, `/api/health`, `/api/auth/status`, `/api/config/public`, `/admin`, `/acceso/login`, contenedores, volumen.
Criterio de cierre: Estado documentado; si rollback aprobado, producción vuelve a modo seguro y health OK.
Riesgos: Editar `.env` sin backup; cortar acceso si era prueba activa aprobada.
Dependencias: Aprobación humana si se cambia `.env`.

#### Título: Arreglar invitaciones para enviar URL de activación con token
Perfil: realstatebackend
Prioridad: P0
Tipo: backend/security
Contexto: `repo.create()` devuelve token pero `invitation-routes.ts` lo descarta y `sendInvitation()` recibe referencia pública.
Objetivo: Que el email contenga una URL de activación segura con token en fragment/query según contrato, sin loggear ni devolver token por API.
Archivos probables: `apps/api/src/auth/invitation-routes.ts`, `apps/api/src/auth/email-provider.ts`, `apps/api/src/auth/invitations.test.ts`, `apps/web/src/auth/ActivationPage.tsx`, `apps/web/e2e/auth.spec.ts`.
Pasos: Construir activation path con token raw; asegurar redacción en logs/respuestas; adaptar capture provider para exponer URL en E2E; añadir tests.
Validación: Unit/integration auth, E2E invitación-signup-email-MFA.
Criterio de cierre: Usuario invitado puede activar sin canal manual y token no se imprime.
Riesgos: Filtrar token en logs/test output.
Dependencias: Ninguna técnica; no deploy hasta E2E requerido verde.

#### Título: Corregir documentos privados del inversor
Perfil: realstatebackend
Prioridad: P0
Tipo: backend/database
Contexto: Ruta inversor consulta `private_documents`, tabla ausente en producción.
Objetivo: Evitar 500 y usar el modelo documental real.
Archivos probables: `apps/api/src/investor/private-routes.ts`, `apps/api/src/providers/document-storage.ts`, migraciones si aplica, tests inversor.
Pasos: Decidir usar `documents` filtrada por owner/visibility o crear migración; implementar; test IDOR/permisos.
Validación: Tests API/inversor; E2E investor documents.
Criterio de cierre: Ruta devuelve lista vacía/real sin 500 y respeta permisos.
Riesgos: Exponer docs privados si filtro incorrecto.
Dependencias: Revisión security.

#### Título: Unificar roles `staff/operator` en DB/API/UI
Perfil: realstatebackend
Prioridad: P0
Tipo: backend/security
Contexto: DB usa `staff`, UI/contratos usan `operator`; casts a enum pueden fallar.
Objetivo: Definir nomenclatura única y compatibilidad segura.
Archivos probables: `apps/api/src/admin/routes.ts`, `apps/api/src/admin/auth.ts`, `packages/contracts/src`, `apps/web/src/admin/*`, migraciones si se elige `operator`.
Pasos: Inventariar usos; elegir `staff` interno + etiqueta `operator` o migrar enum; actualizar Zod/UI/tests.
Validación: Tests admin roles, E2E admin operator.
Criterio de cierre: Asignar/quitar rol operador no falla y RBAC es coherente.
Riesgos: Romper usuario admin/operator existente.
Dependencias: Reviewer.

#### Título: Verificar SMTP, backups y endpoints E2E antes de seguir activación
Perfil: realstatedevops
Prioridad: P0
Tipo: devops/security
Contexto: SMTP activo y backups existen; falta certificación operacional sin secretos.
Objetivo: Confirmar SMTP health sin imprimir credenciales, backups recientes, no E2E expuesto y rollback listo.
Archivos probables: `docs/runbooks/auth-email-setup.md`, `docs/runbooks/auth-backup-recovery.md`, scripts auth.
Pasos: Health provider no-secret, listar backups, `pg_restore --list` en backup reciente, smoke endpoints E2E 404, preparar checklist rollback.
Validación: Comandos read-only y restore-list.
Criterio de cierre: Evidencia documentada y riesgos clasificados.
Riesgos: Tocar backups/secretos; debe ser read-only salvo aprobación.
Dependencias: Ninguna.

### P1 — Operación real

#### Título: Incorporar segundo admin real y recovery MFA
Perfil: realstatedevops
Prioridad: P1
Tipo: operativo/security
Contexto: Solo hay 1 admin activo.
Objetivo: Crear segundo admin real con flujo oficial y documentar recuperación.
Archivos probables: `scripts/auth/*`, runbooks auth.
Pasos: Recibir email real fuera de chat si aplica; crear invitación; completar verificación/MFA; documentar recuperación.
Validación: DB counts sin PII, login/MFA del segundo admin, audit event.
Criterio de cierre: 2 admins activos reales y recovery documentado.
Riesgos: PII/secretos; no crear ficticios.
Dependencias: Email real de Víctor.

#### Título: Cerrar dominio/HTTPS y retirar override HTTP/IP
Perfil: realstatedevops
Prioridad: P1
Tipo: devops/security
Contexto: Activación definitiva requiere HTTPS.
Objetivo: Configurar dominio, Caddy/HTTPS y cookies seguras.
Archivos probables: `docker-compose.yml`, Caddy config, docs deploy/auth.
Pasos: Preparar plan DNS; configurar HTTPS; verificar headers/cookies; quitar override.
Validación: `https://dominio/health`, `/api/health`, cookies Secure, no auth sobre HTTP/IP.
Criterio de cierre: Auth/admin operan solo bajo HTTPS definitivo.
Riesgos: DNS/certificados externos.
Dependencias: Dominio y DNS.

#### Título: Completar SPF/DKIM/DMARC y SMTP definitivo
Perfil: realstatedevops
Prioridad: P1
Tipo: devops/operativo
Contexto: SMTP activo, pero autenticación de dominio pendiente.
Objetivo: Dejar correo transaccional robusto.
Archivos probables: `docs/runbooks/auth-email-setup.md`.
Pasos: Documentar DNS, validar envío/recepción, no imprimir app password.
Validación: Email real de invitación/reset, headers SPF/DKIM/DMARC pass.
Criterio de cierre: Transaccionales llegan sin spam y DNS validado.
Riesgos: Requiere acceso DNS/Gmail.
Dependencias: Dominio/DNS.

#### Título: Publicar legal/cookies/privacidad definitivo
Perfil: realstatefrontend
Prioridad: P1
Tipo: frontend/docs/legal
Contexto: Legal pendiente bloquea operación real.
Objetivo: Integrar textos legales definitivos y consentimiento cookies si aplica.
Archivos probables: `apps/web/src/*`, `docs/PENDIENTES.md`.
Pasos: Incorporar textos aprobados; rutas/footer; banner si procede.
Validación: Build, smoke visual, revisión legal.
Criterio de cierre: Páginas legales publicadas y enlazadas.
Riesgos: Decisiones legales externas.
Dependencias: Textos legales aprobados.

#### Título: Runbook incidentes, monitorización y restore drill
Perfil: realstatedevops
Prioridad: P1
Tipo: devops/docs
Contexto: Backups existen, pero falta drill/retención/alertas.
Objetivo: Definir operación mínima fiable.
Archivos probables: `docs/runbooks/auth-incident.md`, `docs/runbooks/auth-backup-recovery.md`, nuevos scripts si aplica.
Pasos: Política retención; `pg_restore --list`; restore aislado; alertas health/logs.
Validación: Evidencia de restore drill y health monitor.
Criterio de cierre: Runbook accionable y probado.
Riesgos: Coste/tiempo; no tocar producción destructivamente.
Dependencias: Ventana operativa.

### P1 — Producto/app

#### Título: Separar MFA setup y challenge de login
Perfil: realstatefrontend
Prioridad: P1
Tipo: frontend/security
Contexto: Login/MFA no diferencia claramente usuario nuevo vs usuario ya enrolado.
Objetivo: UX segura y clara para login con MFA.
Archivos probables: `apps/web/src/auth/context.tsx`, `LoginPage.tsx`, `TwoFactorPage.tsx`, E2E auth.
Pasos: Manejar `twoFactorRedirect`; pantalla challenge; setup solo para pending_mfa; mensajes seguros.
Validación: E2E auth completo.
Criterio de cierre: Usuario MFA no entra a privado sin challenge.
Riesgos: Romper activación inicial.
Dependencias: Backend auth estable.

#### Título: Bloquear admin SPA por rol antes de renderizar shell
Perfil: realstatefrontend
Prioridad: P1
Tipo: frontend/security
Contexto: Backend protege, pero UI puede mostrar navegación admin a no autorizados.
Objetivo: Pantalla 403/login clara sin filtrar shell admin.
Archivos probables: `apps/web/src/admin/AdminLayout.tsx`, `apps/web/src/auth/guards.tsx`, `apps/web/src/main.tsx`.
Pasos: Guard UX con rol local; mantener backend fail-closed; mensajes 401/403.
Validación: E2E admin/investor.
Criterio de cierre: Inversor no ve nav admin; operator/admin correcto.
Riesgos: Fuente de verdad roles sigue siendo backend.
Dependencias: Unificación roles.

#### Título: Migrar recovery/reset/sesiones UI a Better Auth real
Perfil: realstatefrontend
Prioridad: P1
Tipo: frontend/backend
Contexto: UI usa endpoints legacy `/api/v1/auth/*` en modo Better Auth.
Objetivo: Recuperación y gestión de sesiones operativas.
Archivos probables: `apps/web/src/auth/client.ts`, recovery/reset/account/security, backend Better Auth endpoints.
Pasos: Inventariar endpoints reales; adaptar UI; mensajes anti-enumeración; revocación sesiones.
Validación: E2E auth reset + sesión.
Criterio de cierre: Recovery funciona en Better Auth y revoca sesiones.
Riesgos: Tokens/reset sensibles.
Dependencias: SMTP/capture.

#### Título: Completar área inversor documentos/permisos/solicitudes
Perfil: realstatefrontend
Prioridad: P1
Tipo: frontend/producto
Contexto: Área inversor parcial y documentos backend roto.
Objetivo: Flujo inversor operativo con estados vacíos, permisos y errores claros.
Archivos probables: `apps/web/src/investors/*`, `apps/api/src/investor/*`.
Pasos: Conectar documentos; permisos por proyecto; solicitudes inversión; estados 401/403/500.
Validación: E2E investor.
Criterio de cierre: Inversor real puede ver proyectos permitidos, docs permitidos y solicitudes.
Riesgos: IDOR/documentos.
Dependencias: Backend documentos.

#### Título: Revisar formularios/contacto/coinversión/emails transaccionales
Perfil: realstateqa
Prioridad: P1
Tipo: qa/producto
Contexto: Formularios públicos funcionan, pero deben certificarse con producción-like.
Objetivo: Probar validaciones, honeypot, anti-spam, emails y UX.
Archivos probables: `apps/web/e2e/home.spec.ts`, `apps/api/src/leads/*`, email provider.
Pasos: Smoke API/UI; revisar copy; errores visibles; no PII en logs.
Validación: E2E público y API tests.
Criterio de cierre: Formularios envían/registran y errores son claros.
Riesgos: Datos reales; usar entorno test.
Dependencias: SMTP si emails reales.

### P1 — QA

#### Título: Ejecutar batería completa y clasificar fallos
Perfil: realstateqa
Prioridad: P1
Tipo: qa
Contexto: Auditoría no ejecutó batería completa.
Objetivo: Certificar estado real con lint/type/test/build/database/e2e.
Archivos probables: suites existentes.
Pasos: `pnpm install --frozen-lockfile`; lint; typecheck; test; build; `./scripts/test-database.sh`; E2E público/admin/auth/inversor.
Validación: Exit 0 o clasificación de fallos.
Criterio de cierre: Matriz de resultados completa y reproducible.
Riesgos: Tiempo/Docker; limpiar E2E aislado.
Dependencias: Docker local/runner activo.

#### Título: Cubrir gaps E2E inversor/admin/auth
Perfil: realstateqa
Prioridad: P1
Tipo: qa/security
Contexto: Hay gaps en MFA challenge, docs, roles, recovery.
Objetivo: Añadir cobertura sin skips.
Archivos probables: `apps/web/e2e/auth.spec.ts`, `admin.spec.ts`, `investor.spec.ts`.
Pasos: Casos por rol; docs; reset; invitation; cookies; 401/403.
Validación: Suites verdes.
Criterio de cierre: Gaps P0/P1 cubiertos.
Riesgos: Flakiness/auth setup.
Dependencias: Fixes backend/frontend.

#### Título: Tests rollback, SMTP y backup/restore
Perfil: realstateqa
Prioridad: P1
Tipo: qa/devops
Contexto: Operación real requiere drills.
Objetivo: Validar procedimientos sin afectar producción.
Archivos probables: scripts/runbooks.
Pasos: Test de rollback en entorno aislado; SMTP capture/real según entorno; restore-list/restore aislado.
Validación: Evidencia de comandos.
Criterio de cierre: Runbooks ejecutables y probados.
Riesgos: No tocar datos reales.
Dependencias: DevOps.

### P2 — Calidad

#### Título: Reducir `as any` y fortalecer tipos en rutas admin/auth
Perfil: realstatebackend
Prioridad: P2
Tipo: backend/calidad
Contexto: Grep muestra muchos `as any`, especialmente admin/auth/tests.
Objetivo: Tipos explícitos para params/request context.
Archivos probables: `apps/api/src/admin/routes.ts`, `auth/*`, tests.
Pasos: Tipar params y request decorators; reducir casts; tests.
Validación: typecheck/lint/test.
Criterio de cierre: Menos casts críticos y sin regresión.
Riesgos: Refactor amplio.
Dependencias: P0/P1 primero.

#### Título: Actualizar docs testing/PENDIENTES
Perfil: realstatereviewer
Prioridad: P2
Tipo: docs
Contexto: Docs desactualizadas con 13 migraciones/14 tests y modo seguro falso.
Objetivo: Sincronizar documentación con estado real.
Archivos probables: `docs/testing.md`, `docs/PENDIENTES.md`.
Pasos: Actualizar cifras y estado; registrar activación temporal o rollback.
Validación: `git diff --check`, revisión.
Criterio de cierre: Docs no contradicen producción.
Riesgos: Cambiar docs antes de decidir rollback puede quedar obsoleto.
Dependencias: Decisión P0 auth/admin.

#### Título: Mejorar accesibilidad y feedback admin/inversor
Perfil: realstatefrontend
Prioridad: P2
Tipo: frontend/calidad
Contexto: Formularios dinámicos necesitan labels/aria/errors y feedback de mutaciones.
Objetivo: UX accesible y clara.
Archivos probables: `apps/web/src/admin/editor/*`, `SubEntityEditors.tsx`, `investors/*`.
Pasos: Labels, `aria-describedby`, keyboard nav, toasts/alerts, errores 409.
Validación: axe + Playwright teclado.
Criterio de cierre: Sin violaciones críticas y UX robusta.
Riesgos: Cambios visuales requieren preview/aprobación.
Dependencias: P1 funcional.

#### Título: Observabilidad mínima
Perfil: realstatedevops
Prioridad: P2
Tipo: devops
Contexto: Healthchecks existen, falta alerta/retención/log summary.
Objetivo: Monitor básico de health, disco, backups y errores API.
Archivos probables: docs/scripts futuros.
Pasos: Definir checks; alertas; log rotation; no exponer Hermes.
Validación: Simulación de alerta y runbook.
Criterio de cierre: Señales mínimas operativas.
Riesgos: Ruido/credenciales.
Dependencias: Ninguna.

## 22. Recomendación de orden

1. `realstatedevops`: decidir/corregir postura auth/admin temporal HTTP/IP.
2. `realstatebackend`: invitaciones con token y documentos privados.
3. `realstatebackend` + `realstatereviewer`: unificar roles y revisar RBAC/auditoría.
4. `realstatefrontend`: MFA challenge/setup, admin guard UX y recovery Better Auth.
5. `realstateqa`: batería completa y gaps E2E auth/admin/inversor.
6. `realstatedevops`: dominio/HTTPS/SMTP/SPF-DKIM-DMARC/backup restore.
7. `realstatereviewer`: revisión seguridad final y docs/legal/operaciones.

## 23. Validaciones ejecutadas durante auditoría

- `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main` local.
- `git pull --ff-only origin main` local para alinear con producción.
- SSH read-only de estado Git/release/health/containers/volumen/backups.
- `pnpm audit --audit-level=low` → sin vulnerabilidades conocidas.
- `git grep -nE 'force-verify|force-active|force-mfa|console\.log|console\.error|password=|token=|SECRET|TODO|FIXME|as any|accept.*500|status.*500'` → 342 coincidencias clasificadas.
- `git grep` de `.only/.skip` → sin coincidencias.
- Auditoría frontend ejecutó `pnpm --filter @realstate/web typecheck` y `pnpm --filter @realstate/web test` → OK, 12 archivos / 48 tests.
- Auditoría DevOps ejecutó `bash -n scripts/*.sh scripts/auth/*.sh`, `docker compose --env-file .env.example config --quiet`, `pnpm lint`, `pnpm typecheck` → OK según subauditoría.

## 24. Producción tocada

No se tocó producción. Solo inspección read-only por SSH, curl local en el host remoto, `docker ps`, `docker volume ls`, `ls` de backups y consultas agregadas no PII en PostgreSQL.

No se editó `.env`, no se hizo deploy, no se ejecutó `docker compose down -v`, no se borró ningún volumen ni backup.
