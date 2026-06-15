# Especificación de producto — MILLENNIALS CONSTRUYEN | CAPITAL

## Versión actual: Hito 11 (baseline definitivo)

### Lo que está terminado

| Funcionalidad | Estado |
|---|---|
| Landing pública institucional | ✅ Funcional |
| Catálogo público de oportunidades | ✅ Funcional (4 oportunidades demo) |
| Ficha pública de oportunidad | ✅ Funcional (highlights, riesgos, hitos, media) |
| Modelo de datos definitivo (28 tablas) | ✅ Inmutable |
| Migraciones gestionadas por runner | ✅ Advisory lock, checksum, transacciones |
| Seed idempotente | ✅ 5 oportunidades (4 públicas + 1 privada) |
| Representación financiera | ✅ Céntimos, basis points, sin float |
| Health checks | ✅ /health, /api/health con dependencia PostgreSQL |
| Errores consistentes | ✅ Códigos HTTP, IDs de error, mensajes públicos |

### Lo que está desactivado en producción

| Funcionalidad | Flag | Estado |
|---|---|---|
| Autenticación | `AUTH_ENABLED=false` | 503 |
| Registro | `REGISTRATION_ENABLED=false` | 503 |
| Panel administrativo | `ADMIN_ENABLED=false` | 503 |
| Leads | `LEADS_ENABLED=false` | Desactivado |
| Envío de email | `EMAIL_DELIVERY_ENABLED=false` | Desactivado |
| Seed demo automático | `DEMO_SEED_ENABLED=false` | Desactivado |
| Upload de media en admin | `ADMIN_MEDIA_UPLOAD_ENABLED=false` | Desactivado |

### Lo que depende de integraciones externas

| Funcionalidad | Dependencia |
|---|---|
| HTTPS | Dominio + certificado |
| Email transaccional | Proveedor SMTP |
| Almacenamiento de documentos | S3 compatible |
| KYC | Proveedor externo |
| Firma electrónica | Proveedor externo |
| Pagos / inversión real | Pasarela de pago |

### Estados vacíos reales (no mock)

- Dashboard de inversor: muestra "próximamente"
- Cartera: muestra estado vacío
- Documentos: muestra "sin documentos"
- KYC: muestra "no iniciado"

## Pendiente para Hito 12+

- Contratos Zod centralizados (API ↔ Frontend)
- Interfaces de servicios externos (Email, Storage, KYC, Firma, Pagos)
- Área de inversor funcional (perfil, cuenta, seguridad)
- Workflow editorial completo en admin
- E2E completo (público + administrativo) con baseline definitivo
