# Rotación de Secretos de Autenticación

## BETTER_AUTH_SECRET

Better Auth usa `BETTER_AUTH_SECRET` para firmar cookies de sesión y tokens internos.
Rotarlo invalida TODAS las sesiones activas — los usuarios deberán iniciar sesión de nuevo.

### Procedimiento

1. Generar nuevo secreto (mínimo 32 caracteres, recomendado 64):
   ```bash
   openssl rand -base64 48
   ```

2. Actualizar `shared/.env`:
   ```bash
   BETTER_AUTH_SECRET=<nuevo-secreto>
   ```

3. Desplegar:
   ```bash
   ./scripts/deploy.sh
   ```

4. Verificar que las sesiones antiguas han sido invalidadas:
   ```sql
   -- Todas las sesiones anteriores a la rotación serán rechazadas
   SELECT count(*) FROM auth.session WHERE created_at < now() - interval '1 minute';
   ```

5. Opcionalmente, limpiar sesiones antiguas:
   ```sql
   DELETE FROM auth.session WHERE created_at < now() - interval '1 hour';
   ```

### Frecuencia recomendada

- Rotar cada 90 días
- Rotar inmediatamente si se sospecha exposición
- Rotar después de cualquier incidente de seguridad
- Rotar cuando un miembro del equipo con acceso deja el proyecto

## Credenciales de base de datos

1. Generar nueva contraseña:
   ```bash
   openssl rand -base64 24
   ```

2. Cambiar en PostgreSQL:
   ```sql
   ALTER ROLE realstate WITH PASSWORD '<nueva-contraseña>';
   ```

3. Actualizar `shared/.env`:
   ```bash
   DATABASE_URL=postgres://realstate:<nueva>@postgres:5432/realstate
   ```

4. Desplegar:
   ```bash
   ./scripts/deploy.sh
   ```

## Credenciales SMTP

1. Rotar en el proveedor SMTP
2. Actualizar `shared/.env`:
   ```bash
   SMTP_PASSWORD=<nueva-contraseña-smtp>
   ```
3. Desplegar

## Verificación post-rotación

- [ ] `/health` responde OK
- [ ] `/api/health` postgres OK
- [ ] Login funciona con nuevas credenciales
- [ ] Sesiones antiguas rechazadas
- [ ] Correos se envían correctamente
- [ ] Backup post-rotación verificado

## Rollback

Si la rotación causa problemas:

1. Restaurar `shared/.env` desde backup
2. `./scripts/deploy.sh`
3. Si se rotó la contraseña de BD, restaurarla con el valor anterior
