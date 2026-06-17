# Auth User Lifecycle

## Estados
- `pending_email` → cuenta creada, email no verificado
- `pending_mfa` → email verificado, TOTP pendiente
- `active` → completamente operativo
- `suspended` → bloqueado temporalmente
- `revoked` → acceso permanentemente revocado

## Flujo de activación
1. Staff crea invitación desde solicitud Coinvierte
2. Usuario recibe email con enlace `/acceso/activar#token=...`
3. Usuario verifica email
4. Usuario configura TOTP
5. Usuario queda `active`

## Suspender usuario
```bash
./scripts/auth/suspend-user.sh --user-ref USR-... --reason "Motivo"
```
Efecto: estado → suspended, sesiones revocadas, API bloqueada.

## Reactivar usuario
```bash
./scripts/auth/reactivate-user.sh --user-ref USR-...
```
Efecto: estado → active (si email verificado y MFA activo).
No restaura permisos de proyecto revocados.

## Revocar usuario
```bash
./scripts/auth/revoke-user.sh --user-ref USR-...
```
Efecto: estado → revoked, sesiones revocadas, accesos a proyectos revocados.
Historial conservado. Irreversible sin intervención manual.
