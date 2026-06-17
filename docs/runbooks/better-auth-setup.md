# Better Auth Setup

## Activar autenticación

1. Configurar dominio y HTTPS
2. Generar secret: `openssl rand -base64 48`
3. Configurar SMTP
4. En `shared/.env`:
   ```
   AUTH_MODE=***   BETTER_AUTH_SECRET=<secret>
   BETTER_AUTH_URL=***   AUTH_EMAIL_MODE=***   SMTP_HOST=...
   ```
5. Desplegar: `./scripts/deploy.sh`
6. Verificar: `curl https://DOMINIO/api/config/public` → `{"authEnabled":true}`

## Desactivar autenticación

1. En `shared/.env`: `AUTH_MODE=*** Desplegar: `./scripts/deploy.sh`
3. Las sesiones existentes quedan invalidadas
4. Los usuarios y datos de autorización se conservan

## Rotar BETTER_AUTH_SECRET

1. Generar nuevo secret: `openssl rand -base64 48`
2. Actualizar `BETTER_AUTH_SECRET` en `shared/.env`
3. Desplegar: `./scripts/deploy.sh`
4. Todas las sesiones existentes quedan invalidadas
