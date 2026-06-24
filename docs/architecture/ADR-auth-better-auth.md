# ADR: Sistema de autenticación con Better Auth

**Estado:** Aceptado
**Fecha:** 2026-06-17
**Versión Better Auth:** 1.6.19 (estable, pin exacto)
**Plugins activados:** two-factor, organization
**Rama:** feat/better-auth-private-access

---

## 1. Contexto

MILLENNIALS CONSTRUYEN | CAPITAL necesita un sistema privado de identidad, autenticación y autorización para inversores. El sistema actual usa un mecanismo propio con Argon2id, sesiones en cookie y tokens de verificación, pero carece de:

- 2FA/TOTP obligatorio
- Organización multi-miembro
- Invitaciones formales
- Autorización por proyecto
- Auditoría estructurada
- Modo de captura de correo para desarrollo

Tras evaluar alternativas, se ha decidido migrar a Better Auth como proveedor de autenticación, manteniendo PostgreSQL como fuente de autorización local.

## 2. Decisión

**Better Auth v1.6.19** (pin exacto) con plugins:
- `two-factor` — TOTP obligatorio para todos los inversores
- `organization` — Organización única "MILLENNIALS CONSTRUYEN" como contenedor de miembros

**No se implementan:**
- Login social (OAuth)
- SMS
- Registro público
- Pagos
- Firma contractual
- KYC automatizado por Better Auth

## 3. Alternativas consideradas

| Alternativa | Rechazada por |
|---|---|
| **Clerk** | Proveedor externo, dependencia de terceros, pricing por usuario, datos fuera de nuestro control |
| **Auth0** | Pricing enterprise, vendor lock-in, complejidad innecesaria para club privado |
| **Auth propia (actual)** | Sin 2FA nativo, sin organizaciones, mantenimiento de seguridad crítico, no auditable externamente |
| **Better Auth** | ✅ Open source, PostgreSQL nativo, 2FA + orgs built-in, esquema auditable, sin dependencia externa |

## 4. Responsabilidades

### Better Auth (proveedor de autenticación)
- Hash de contraseñas (bcrypt/argon2 interno)
- Gestión de sesiones (creación, validación, revocación)
- Verificación de email
- TOTP (generación, verificación, códigos de recuperación)
- Organización y pertenencia
- Invitaciones de organización (como framework)
- Rate limiting de autenticación
- Cookies de sesión (HttpOnly, Secure, SameSite)

### Aplicación (autorización y negocio)
- Invitaciones propias (`access_invitations`) — puerta de entrada
- Usuarios internos (`app_users`) — perfil de negocio
- Autorización por proyecto (`project_user_access`)
- Roles locales (`investor`, `operator`, `admin`; `staff` queda solo como alias legacy/deprecado y se normaliza a `operator`)
- Estados del ciclo de vida (`pending_email`, `pending_mfa`, `active`, `suspended`, `revoked`)
- Vinculación Better Auth user ↔ app_user
- Correo transaccional (interfaz propia con provider `disabled`/`capture`/`smtp`)
- Auditoría de eventos de negocio
- Bloqueo local inmediato (independiente de sesiones)

## 5. Límites de confianza

```
┌─────────────────────────────────────────────────┐
│ Aplicación (Fastify)                             │
│  ┌──────────────┐   ┌─────────────────────────┐ │
│  │ Autorización  │   │ Better Auth Handler     │ │
│  │ (app_users,   │   │ /api/auth/*             │ │
│  │  project_     │   │ (sesiones, 2FA, email)  │ │
│  │  access)      │   │                         │ │
│  └──────┬───────┘   └───────────┬─────────────┘ │
│         │                       │                │
│  ┌──────┴───────────────────────┴─────────────┐ │
│  │              PostgreSQL                     │ │
│  │  ┌──────────────┐  ┌────────────────────┐  │ │
│  │  │ Esquema auth  │  │ Esquema public      │  │ │
│  │  │ (Better Auth) │  │ (app_users,         │  │ │
│  │  │ user, session,│  │  opportunities,     │  │ │
│  │  │ account, 2FA, │  │  leads, projects)   │  │ │
│  │  │ org, member,  │  │                     │  │ │
│  │  │ invitation,   │  │                     │  │ │
│  │  │ verification  │  │                     │  │ │
│  │  └──────────────┘  └────────────────────┘  │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- Better Auth gestiona identidad y sesiones en el esquema `auth`
- La aplicación gestiona autorización y negocio en el esquema `public`
- La API de negocio NUNCA consulta directamente las tablas de Better Auth
- La vinculación se hace mediante `app_users.better_auth_user_id`
- Las sesiones de Better Auth son la única fuente de verdad para "quién eres"
- La autorización local es la única fuente de verdad para "qué puedes hacer"

## 6. Acceso por invitación

El registro público está cerrado. El flujo es:

1. Solicitud Coinvierte → lead en `leads` (ya existe)
2. Staff revisa lead → crea `access_invitations` con token opaco
3. Email con enlace `/acceso/activar#token=TOKEN`
4. Token en fragmento URL → memoria JS → `history.replaceState`
5. Registro protegido con header `X-Invitation-Token`
6. Better Auth crea usuario → vinculación con `app_users`
7. Verificación email → TOTP obligatorio → activación
8. Asignación server-side a organización "MILLENNIALS CONSTRUYEN"
9. Asignación manual de proyectos por operator/admin

## 7. Modos de autenticación

### `AUTH_MODE=disabled` (predeterminado en producción)
- Comportamiento actual preservado
- `/acceso` informativa
- `/acceso#solicitud` operativo (Coinvierte)
- Sin formularios de login
- Rutas privadas devuelven 503 seguro
- Sin bypass ni usuarios simulados

### `AUTH_MODE=better-auth`
- Better Auth activo
- Login, MFA, verificación, sesiones
- Área privada operativa
- Autorización local aplicada

## 8. Estrategia de migraciones

- **0008**: Esquema `auth` con tablas de Better Auth (user, session, account, verification, twoFactor, organization, member, invitation)
- **0009**: Tablas de autorización local (app_users, access_invitations, project_user_access, auth_audit_events)

Las migraciones son aditivas. No modifican las migraciones 0001-0007 existentes.

## 9. Estrategia de actualización de Better Auth

1. Bloquear `better-auth` a versión exacta en `package.json` (`1.6.19`, sin `^` ni `~`)
2. Antes de actualizar: revisar CHANGELOG y breaking changes
3. Generar nuevo esquema con `getAuthTables(config)` para la nueva versión
4. Comparar con esquema actual (diff de tablas/columnas)
5. Crear migración aditiva con los cambios
6. Probar en entorno efímero con copia de producción
7. Actualizar dependencia + migración juntas
8. Nunca ejecutar migraciones automáticas de Better Auth sobre producción

## 10. Rollback

- `AUTH_MODE=disabled` desactiva toda la autenticación
- Las tablas `auth.*` permanecen (no se eliminan)
- La aplicación vuelve al estado informativo
- Las sesiones existentes se invalidan (no se usan con `AUTH_MODE=disabled`)
- No hay pérdida de datos de autorización

## 11. Bloqueantes actuales

1. Dominio definitivo (actualmente IP directa)
2. HTTPS (necesario para cookies Secure)
3. SMTP funcional (correo transaccional real)
4. SPF/DKIM/DMARC
5. Textos legales (política de privacidad, términos)
6. Procedimiento de brecha de seguridad
7. Revisión de dependencias externa

## 12. Migración futura

Si en el futuro se necesita migrar a otro proveedor:

1. Better Auth es propietario del hash de contraseñas — migración requeriría reset de contraseñas o exportación de hashes
2. Las sesiones son opacas — no se pueden migrar
3. `app_users.better_auth_user_id` tendría que mapearse al nuevo proveedor
4. Las tablas `auth.*` quedarían obsoletas pero los datos de negocio en `public.*` permanecen
5. El modelo de autorización local (app_users, project_user_access) es independiente del proveedor
