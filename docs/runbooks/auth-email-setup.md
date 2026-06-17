# Configuración de Correo Transaccional

## Modos disponibles

| Modo | Variable | Descripción |
|---|---|---|
| `disabled` | `AUTH_EMAIL_MODE=*** | No envía correos. Auth no se activa. |
| `capture` | `AUTH_EMAIL_MODE=capture` | Captura mensajes en memoria. SOLO tests/desarrollo. |
| `smtp` | `AUTH_EMAIL_MODE=smtp` | Envío real vía SMTP con TLS. |

## Configuración SMTP

Variables en `shared/.env`:

```bash
AUTH_EMAIL_MODE=smtp
...p
SMTP_SECURE=true
SMTP_PASSWORD=<contraseña>
```

### Proveedores recomendados

| Proveedor | SMTP_HOST | SMTP_PORT | SMTP_SECURE | Notas |
|---|---|---|---|---|
| SendGrid | smtp.sendgrid.net | 587 | false | STARTTLS |
| AWS SES | email-smtp.eu-west-1.amazonaws.com | 587 | false | STARTTLS |
| Mailgun | smtp.mailgun.org | 587 | false | STARTTLS |
| Resend | smtp.resend.com | 587 | false | STARTTLS |
| Postmark | smtp.postmarkapp.com | 587 | false | STARTTLS |

### Verificación de conexión

```bash
# Probar conexión SMTP
openssl s_client -starttls smtp -connect SMTP_HOST:587 -crlf

# Desde la API
docker compose exec api node -e "
const { createTransport } = require('nodemailer');
const t = createTransport({host:'SMTP_HOST',port:587,secure:false,auth:{user:'SMTP_USER',pass:'SMTP_PASSWORD'}});
t.verify((err) => console.log(err || 'OK'));
"
```

## DNS: SPF, DKIM, DMARC

### SPF (Sender Policy Framework)

Añadir registro TXT al DNS del dominio:
```
v=spf1 include:spf.<proveedor>.com ~all
```
Ejemplo SendGrid: `v=spf1 include:sendgrid.net ~all`

### DKIM (DomainKeys Identified Mail)

Configurar en el proveedor SMTP. Genera un registro CNAME en el DNS:
```
<selector>._domainkey.<dominio> CNAME <selector>.<proveedor>.net
```

### DMARC

Registro TXT en `_dmarc.<dominio>`:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@<dominio>; ruf=mailto:dmarc@<dominio>; fo=1
```

## Plantillas de correo

Las plantillas están en `apps/api/src/auth/email-provider.ts` en `SmtpAuthEmailProvider`:

| Método | Asunto |
|---|---|
| `sendVerification` | "Verifica tu dirección de correo — MILLENNIALS CONSTRUYEN" |
| `sendPasswordReset` | "Recuperación de contraseña — MILLENNIALS CONSTRUYEN" |
| `sendPasswordChanged` | "Contraseña modificada — MILLENNIALS CONSTRUYEN" |
| `sendMfaEnabled` | "Verificación en dos pasos activada — MILLENNIALS CONSTRUYEN" |
| `sendAccountSuspended` | "Cuenta suspendida — MILLENNIALS CONSTRUYEN" |
| `sendAccountReactivated` | "Cuenta reactivada — MILLENNIALS CONSTRUYEN" |
| `sendSessionsRevoked` | "Sesiones revocadas — MILLENNIALS CONSTRUYEN" |

Todas las plantillas usan `escapeHtml()` para sanitizar contenido dinámico.
Las URLs se validan contra `BETTER_AUTH_URL` antes de incluirse.
Nunca se registran cuerpos completos, destinatarios ni enlaces en logs.

## Test de entrega

```bash
# Con AUTH_EMAIL_MODE=capture (solo desarrollo/test):
# Los correos se capturan en memoria y pueden inspeccionarse vía API interna

# Verificar que no hay tokens en logs:
docker compose logs api | grep -i "token\|link\|url" | wc -l
# Debe ser 0

# Verificar que no hay emails completos en logs:
docker compose logs api | grep -oP '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | wc -l
# Debe ser 0
```

## Solución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED` | SMTP_HOST o puerto incorrecto | Verificar host y puerto |
| `Authentication failed` | Credenciales incorrectas | Verificar SMTP_USER y SMTP_PASSWORD |
| `Certificate error` | TLS/SSL mal configurado | Ajustar SMTP_SECURE |
| `Timeout` | Firewall bloquea puerto | Verificar conectividad de red |
| Correos en spam | SPF/DKIM/DMARC no configurados | Completar configuración DNS |
