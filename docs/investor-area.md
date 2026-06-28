# Área inversora — rutas, datos y superficies

## Rutas privadas

Todas las rutas bajo `/inversores` requieren sesión autenticada cuando `AUTH_ENABLED=true`.

| Ruta | Componente | API endpoint | Superficie |
|------|------------|--------------|------------|
| `/inversores` | `InvestorDashboard` | `GET /api/v1/auth/me` | Identidad y resumen del usuario |
| `/inversores/perfil` | `InvestorProfile` | `GET /api/v1/auth/me` | Datos de perfil |
| `/inversores/cartera` | `InvestorPortfolio` | `GET /api/investor/projects` | Proyectos asignados al usuario |
| `/inversores/proyectos/:slug` | `InvestorProjectDetail` | `GET /api/investor/projects/:slug` + `GET /api/investor/projects/:slug/documents` | Detalle privado del proyecto asignado |
| `/inversores/documentos` | `InvestorDocuments` | `GET /api/investor/documents` | Documentos privados autorizados |
| `/inversores/verificacion` | `InvestorVerification` | `GET /api/investor/verification` | Estado KYC real o proveedor no configurado |
| `/inversores/oportunidades` | `InvestorOpportunities` | `GET /api/investor/opportunities` + `GET /api/investor/investment-requests` | Catálogo público con acciones privadas |
| `/inversores/cuenta` | `InvestorAccount` | `GET /api/v1/auth/sessions` | Sesiones activas |
| `/inversores/seguridad` | `InvestorSecurity` | Endpoints Better Auth | Seguridad de cuenta |

`/inversor` existe como alias histórico. La ruta canónica para usuarios es `/inversores`.

## Separación público / privado / admin

El backend conserva el modelo completo y es la fuente de verdad. Las APIs exponen DTOs distintos según superficie.

| Campo / dato | Backend/Admin | Home pública | Ficha pública | Área logeada oportunidades | Cartera privada | Detalle privado | Documentos privados |
|--------------|---------------|--------------|----------------|----------------------------|-----------------|-----------------|---------------------|
| `slug`, `title`, `shortDescription` | Sí | Sí | Sí | Sí | Sí | Sí | Vinculado por proyecto |
| `description` | Sí | No | Sí | No | No | Sí, si el usuario tiene acceso | No |
| `city`, `district`, `countryCode` | Sí | Sí | Sí | Sí | Sí | Sí | No |
| `assetType`, `strategy` | Sí | Sí | Sí | Sí | No | Sí | No |
| Estado público del proyecto | Sí | Sí | Sí | Sí | Sí | Sí | No |
| `visibility`, `editorial_status`, `published_at` | Sí | No | No | No | No | No | No |
| Importes base internos (`target_amount_cents`, `committed_amount_cents`) | Sí | No como campos crudos | No como campos crudos | No como campos crudos | Sí en endpoint privado asignado | Sí en endpoint privado asignado | No |
| `publicInvestmentAmount` / inversión necesaria | Sí | Sí | Sí | Sí | No | Sí | No |
| `projectTotalAmount` / CAPEX total | Sí | No | Sí | Sí si la superficie privada lo requiere | No | Sí | No |
| `minimumInvestment` | Sí | Sí | Sí | Sí | No | No | No |
| `estimatedTermMonths` | Sí | Sí | Sí | Sí | No | Sí | No |
| `publicReturnDisplay` | Sí | Sí | Sí | Sí | No | Derivado privado visible | No |
| `fundingProgress` / progreso público de inversión | Sí | Sí | Sí | Sí | No | Sí | No |
| `bankFinancingAmount` | Sí | No | Sí | No | No | No | No |
| `riskLevel`, `targetReturnType`, `targetReturnBps`, `closingDate` | Sí | No | Solo `closingDate` pública aprobada | No | No | Sí si procede | No |
| Datos de información (`highlights`) | Sí | No | Sí, dentro de `Información` | No | No | No | No |
| Riesgos e hitos | Sí, editables en admin/backend | No | No en la ficha pública simplificada | No | No | No | No |
| Media pública | Sí | Imagen principal | Galería pública | Imagen principal | No | No | No |
| Capital del usuario | Sí | No | No | Sí, solo si hay acceso | Sí | Sí | No |
| Estado de acceso del usuario | Sí | No | No | Sí | Sí | Sí | Sí como autorización |
| Notas privadas del equipo | Sí | No | No | Sí, solo si hay acceso | Sí | Sí | No |
| Solicitudes/transferencias del usuario | Sí | No | No | Sí | No | No | No |
| Documentos privados | Sí | No | No | No | Resumen no | Sí, por proyecto | Sí |
| Auditoría/versiones | Sí | No | No | No | No | No | No |

## Reglas de publicación

- Una oportunidad aparece en APIs públicas solo si cumple simultáneamente:
  - `visibility = 'public'`
  - `editorial_status = 'published'`
  - `published_at IS NOT NULL`
- El botón de publicar del admin pone `editorial_status='published'`, `visibility='public'` y completa `published_at` si estaba vacío.
- Despublicar o archivar saca el proyecto de la superficie pública.

## DTOs públicos

### Home y cards públicas

`GET /api/v1/opportunities` entrega solo el DTO público mínimo:

- `slug`
- `title`
- `shortDescription`
- `city`
- `countryCode`
- `district`
- `assetType`
- `strategy`
- `status`
- `currency`
- `primaryImage`
- `publicInvestmentAmount`
- `minimumInvestment`
- `estimatedTermMonths`
- `publicReturnDisplay`
- `fundingProgress`
- `disclaimer`

No entrega `riskLevel`, `targetAmount`, `committedAmount`, `publishedAt` ni `targetReturnType`.
`publicInvestmentAmount` es el importe de inversión necesario/objetivo. El importe cubierto no se entrega como campo independiente en superficies públicas: se refleja únicamente en `fundingProgress`.

### Ficha pública

`GET /api/v1/opportunities/:slug` añade:

- `description`
- `projectTotalAmount`
- `bankFinancingAmount`
- `closingDate`
- `highlights`
- `risks`
- `milestones`
- `media`

La UI pública actual muestra `highlights` como filas homogéneas dentro de `Información`, y muestra `projectTotalAmount`/`bankFinancingAmount` como filas independientes de `Datos clave`. `risks` y `milestones` siguen disponibles en backend/admin para edición y futuras superficies, pero no se renderizan en la ficha pública simplificada.

### Concordancia admin/backend/público de proyectos

| Ficha pública | Campo admin editable | Campo backend/DB | Nota |
|---------------|----------------------|------------------|------|
| Estado del proyecto | Estado operativo | `status` | Destacado junto a `Información`, no duplicado en `Datos clave`. |
| Descripción | Descripción | `description` | Cuerpo principal de `Información`. |
| Tipo de activo | Activo y estrategia → Tipo de activo | `asset_type` | Fila homogénea de `Información`. |
| Estrategia | Activo y estrategia → Estrategia | `strategy` | Fila homogénea de `Información`. |
| Filas extra de `Información` | Datos de información | `opportunity_highlights` | Añadir/ordenar/eliminar desde admin. |
| Inversión | Datos clave → Inversión / capital objetivo | `target_amount_cents` | El importe cubierto no se muestra como cifra independiente. |
| Progreso de inversión | Datos clave → Capital comprometido | `committed_amount_cents` | Solo alimenta `fundingProgress`. |
| CAPEX total | Datos clave → CAPEX total | `project_total_amount_cents` | Nullable; si falta, la API pública cae a inversión. |
| Financiación bancaria | Datos clave → Financiación bancaria | `bank_financing_amount_cents` | Nullable; si falta, la API pública deriva `CAPEX - inversión`. |
| Ticket mínimo | Datos clave → Ticket mínimo | `minimum_investment_cents` | Fila homogénea de `Datos clave`. |
| Plazo estimado | Datos clave → Plazo estimado | `estimated_term_months` | Fila homogénea de `Datos clave`. |
| Retorno estimado | Datos clave → Tipo/retorno objetivo | `target_return_type`, `target_return_bps` | La API pública devuelve `publicReturnDisplay`. |

## DTO privado de inversor

### Catálogo logeado con acciones privadas

`GET /api/investor/opportunities` reutiliza los campos públicos necesarios y añade únicamente estado privado del usuario autenticado:

- `investorAccess.status`
- `investorAccess.committedAmount`
- `investorAccess.notes`
- `investmentRequests[]`

No acepta IDs de usuario desde cliente; el usuario sale de la sesión.

### Cartera y detalle privado

`GET /api/investor/projects` lista proyectos asignados. `/inversores/cartera` enlaza cada posición a `/inversores/proyectos/:slug`.

`GET /api/investor/projects/:slug` devuelve la ficha privada solo si `project_user_access` autoriza al usuario autenticado. El detalle puede mostrar capital del usuario, estado de su posición, notas del equipo y métricas privadas del proyecto.

## Estados vacíos honestos

- Cartera: muestra que todavía no hay capital asignado si `GET /api/investor/projects` no devuelve posiciones con capital.
- Documentos: muestra que no hay documentos si `GET /api/investor/documents` devuelve `data: []`.
- Verificación: mientras `PROVIDER_KYC=disabled`, no se guarda ni envía documentación sensible, no se generan enlaces externos y nunca se marca al inversor como verificado de forma ficticia.

## Seguridad

- Todas las rutas privadas requieren sesión real cuando `AUTH_ENABLED=true`.
- Contexto anónimo → redirigido a `/acceso`.
- Usuario normal → sin acceso a `/admin`.
- API del inversor deriva `appUser.id` exclusivamente de la cookie/sesión.
- No se aceptan IDs de usuario desde el cliente para consultar datos privados.
- No se exponen documentos privados desde endpoints públicos.
- No se muestran datos personales ni identificadores internos en la home pública ni en la ficha pública.
