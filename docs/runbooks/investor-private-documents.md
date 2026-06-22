# Documentos privados de inversor

Fecha: 2026-06-20

## Estado runtime

La ruta operativa de documentos privados usa Better Auth + `app_users` + `project_user_access` + tabla canónica `documents`.

Rutas:

- `GET /api/investor/documents` — lista todos los documentos privados autorizados del usuario.
- `GET /api/investor/projects/:id/documents` — lista documentos privados de un proyecto autorizado.
- `GET /api/investor/projects/:id/documents/:documentId/download` — genera descarga solo si existe `storage_ref` y el provider de storage está configurado.

La API de listado no expone `storage_ref`. En su lugar devuelve `download_available`, calculado como `NULLIF(storage_ref, '') IS NOT NULL` + provider de storage configurado.

## Reglas de seguridad

- No usar `private_documents`; esa tabla no es parte del runtime.
- No mostrar documentos de proyectos sin `project_user_access.status='active'` salvo roles operativos (`operator`, `staff`, `admin`).
- No generar enlaces falsos.
- Si el documento no tiene fichero, responder `document_unavailable`.
- Si storage está deshabilitado/no configurado, responder `provider_not_configured`.
- No exponer `storage_ref` al frontend.
- No mostrar botón/enlace de descarga si `download_available=false`.
- No imprimir URLs firmadas en logs ni chats.

## UI

`/inversores/documentos` consume `GET /api/investor/documents` y cubre:

- loading;
- empty state honesto;
- error state;
- listado real;
- enlace de descarga solo si `download_available=true`.
- etiqueta “Descarga no disponible” cuando el documento existe pero no hay fichero/provider configurado.

## Verificación mínima

```bash
pnpm --filter @realstate/api test -- private-routes.test.ts --runInBand
pnpm test:e2e:investor
```

Además, en producción:

```sql
SELECT to_regclass('public.documents') AS documents_table,
       to_regclass('public.private_documents') AS private_documents_table;
```

Esperado:

- `documents_table = documents`;
- `private_documents_table = null/missing`;
- referencias runtime a `private_documents` = 0.
