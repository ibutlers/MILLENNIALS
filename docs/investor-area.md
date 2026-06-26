# Área inversora — rutas y estados

## Rutas

Todas las rutas bajo `/inversores` requieren sesión autenticada (excepto cuando `AUTH_ENABLED=false`, en cuyo caso `RequireAuth` permite el acceso).

| Ruta | Componente | API endpoint | Estado |
|------|-----------|-------------|--------|
| `/inversores` | `InvestorDashboard` | `GET /api/v1/auth/me` | Identidad real del usuario |
| `/inversores/perfil` | `InvestorProfile` | `GET /api/v1/auth/me` | Datos existentes, campos vacíos indicados |
| `/inversores/cartera` | `InvestorPortfolio` | `GET /api/v1/investor/portfolio` | Array vacío |
| `/inversores/documentos` | `InvestorDocuments` | `GET /api/v1/investor/documents` | Array vacío |
| `/inversores/verificacion` | `InvestorVerification` | `GET /api/v1/investor/verification` | Flujo preparatorio KYC; proveedor externo pendiente |
| `/inversores/oportunidades` | `InvestorOpportunities` | `GET /api/v1/opportunities` | Catálogo público |
| `/inversores/cuenta` | `InvestorAccount` | `GET /api/v1/auth/sessions` | Sesiones activas |

## Estados vacíos honestos

### Cartera
- **API:** `GET /api/v1/investor/portfolio` devuelve `investments: []` y `summary` con ceros.
- **UI:** Muestra "Todavía no tienes inversiones activas." Sin rentabilidad ficticia, capital simulado ni gráficos falsos.

### Documentos
- **API:** `GET /api/v1/investor/documents` devuelve `documents: []`.
- **UI:** Muestra "No hay documentos disponibles." Sin contratos, certificados ni descargas ficticias.

### Verificación
- **API:** `GET /api/v1/investor/verification` consulta `providers.kyc.health()`.
  - Si `not_configured` → devuelve `status: "not_configured"`.
  - Si error → envuelve el error, nunca devuelve `status: "approved"` falso.
- **UI:** Muestra un flujo preparatorio de 3 pasos para elegir persona física/empresa, recopilar datos de perfil y revisar la documentación prevista.
- **Límite operativo:** mientras `PROVIDER_KYC=disabled`, no se guardan ni se envían datos sensibles a terceros, no se permite subir documentos, no se generan enlaces/QR y no se muestra ningún estado verificado ficticio.

## Seguridad

- Todas las rutas privadas requieren sesión real (cuando `AUTH_ENABLED=true`).
- Contexto anónimo → redirigido a `/acceso`.
- Usuario normal → sin acceso a `/admin` (403 de API).
- API del inversor deriva `userId` exclusivamente de la cookie de sesión.
- No se aceptan IDs de usuario desde el cliente para consultar datos privados.
- Respuestas tipadas con contratos compartidos.
- Arrays vacíos cuando no hay recursos (no `null`, no objetos vacíos con mensajes engañosos).
