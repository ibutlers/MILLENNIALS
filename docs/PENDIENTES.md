# Pendientes de Realstate

## Legales — antes de abrir la captación al público

- [ ] Incorporar los datos identificativos reales del responsable:
  - Razón social
  - NIF o CIF
  - Domicilio
  - Correo de contacto
  - Datos registrales (cuando correspondan)
- [ ] Redactar y publicar el Aviso legal definitivo
- [ ] Redactar y publicar la Política de privacidad definitiva
- [ ] Revisar los textos de consentimiento de `Contacto` y `Coinvierte` cuando estén disponibles

## Autenticación — antes de activar AUTH_MODE=*** Dominio definitivo
- [ ] Certificado HTTPS (necesario para cookies Secure)
- [ ] Configurar BETTER_AUTH_URL con el dominio definitivo
- [ ] Generar BETTER_AUTH_SECRET de producción (mínimo 32 caracteres)

## Correo transaccional — antes de activar auth real
- [ ] Contratar y configurar proveedor SMTP
- [ ] Configurar SPF, DKIM, DMARC para el dominio
- [ ] Configurar SMTP_HOST, SMTP_USER, SMTP_PASSWORD en shared/.env
- [ ] Verificar entregabilidad de correos (inbox, no spam)
- [ ] Activar AUTH_EMAIL_MODE=*** Redactar plantillas de correo definitivas:
  - [ ] Invitación
  - [ ] Verificación de email
  - [ ] Recuperación de contraseña
  - [ ] Contraseña modificada
  - [ ] MFA activado
  - [ ] Cuenta suspendida / reactivada
  - [ ] Sesiones revocadas

## Cookies y privacidad
- [ ] Revisar cookies necesarias de autenticación para banner de cookies
- [ ] Documentar retención de sesiones (8 horas máximo)

## Seguridad
- [ ] Procedimiento de brecha de seguridad documentado
- [ ] Revisión de dependencias (Better Auth y transitivas)
- [ ] Auditoría externa de seguridad antes de operaciones sensibles
- [ ] Decisión sobre tratamiento de IP (no almacenar permanentemente sin base legal)

## Operaciones
- [ ] Scripts operativos CLI (./scripts/auth/*) — pendientes de implementar
- [ ] Procedimiento de backup/restore con tablas auth.*
- [ ] Recuperación de cuentas (usuario pierde acceso a 2FA)
- [ ] Dos cuentas administrativas seguras (admin + backup)

## Mejoras futuras
- [ ] Tests E2E del flujo completo de invitación + activación + MFA
- [ ] Tests IDOR con dos inversores y proyectos
- [ ] Implementar SMTP AuthEmailProvider
- [ ] Documentos privados con storage provider real
