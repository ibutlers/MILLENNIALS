# Auth Incident Response

## Token de invitación filtrado
1. Revocar invitación: `./scripts/auth/revoke-invitation.sh --ref INV-...`
2. Si el usuario ya se registró: suspender usuario
3. Investigar cómo se filtró el token
4. Rotar BETTER_AUTH_SECRET si hay compromiso del servidor

## Cuenta comprometida
1. Suspender usuario inmediatamente
2. Revocar todas las sesiones
3. Notificar al usuario por canal alternativo
4. Investigar actividad en auth_audit_events
5. Restablecer contraseña y MFA
6. Reactivar solo después de verificación

## Sesiones sospechosas
1. Listar sesiones del usuario en auth.session
2. Revocar sesiones específicas o todas
3. Si hay patrón de ataque: suspender cuenta temporalmente

## Rollback a AUTH_MODE=*** 1. En `shared/.env`: `AUTH_MODE=*** Desplegar: `./scripts/deploy.sh`
3. Toda autenticación queda deshabilitada
4. La landing y formularios públicos siguen funcionando
