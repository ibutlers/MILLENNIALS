# Roles operator/staff/admin

Fecha de revisión: 2026-06-24.

## Modelo canónico

- `admin`: administración completa. Puede gestionar usuarios, roles, sesiones, auditoría, invitaciones admin y acciones destructivas protegidas por reglas de último admin.
- `operator`: operador no admin. Puede operar oportunidades, leads, inversiones y vistas necesarias del panel, pero no puede gestionar usuarios, roles, sesiones, auditoría ni crear/revocar administradores.
- `investor`: inversor. Solo accede al área privada de inversor y a proyectos/documentos concedidos.
- `staff`: rol legacy/deprecado. Puede seguir existiendo en el enum PostgreSQL y en filas históricas, pero se normaliza a `operator` en API, CLI y UI.

## Decisión sobre `staff`

`staff` se mantiene en la base de datos solo por compatibilidad con datos o invitaciones antiguas. No debe usarse para nuevas altas.

Reglas:

1. Las nuevas invitaciones operativas usan `operator`.
2. Los scripts aceptan `staff` únicamente como alias legacy y lo normalizan a `operator`.
3. La UI nunca debe mostrar `staff`; debe mostrar `operator`.
4. Los guards de backend tratan filas `staff` como `operator`, nunca como `admin`.
5. El cliente no puede asignar roles arbitrarios: las rutas de administración validan contra `investor | operator | admin`.

## Permisos

| Acción | investor | operator | admin |
|---|---:|---:|---:|
| Área privada inversor propia | Sí | No aplica | No aplica |
| Ver dashboard admin | No | Sí | Sí |
| Listar/editar oportunidades | No | Sí | Sí |
| Transición `draft -> review` / `review -> draft` | No | Sí | Sí |
| Publicar/unpublish/archive/restaurar versiones | No | No | Sí |
| Gestionar leads/notas | No | Sí | Sí |
| Ver solicitudes de inversión | No | Sí | Sí |
| Aprobar/rechazar/confirmar solicitudes | No | No | Sí |
| Gestionar usuarios/roles/sesiones | No | No | Sí |
| Ver auditoría | No | No | Sí |
| Crear invitaciones admin | No | No | Sí, vía flujo oficial |

## Scripts operativos

- Segundo admin real: `scripts/auth/invite-admin.sh --email ADMIN_EMAIL_2 --yes`
- Invitaciones generales: `scripts/auth/invite-user.sh --email persona@dominio.com --role investor|operator|admin --yes [--send]`
- Leads Coinvierte: `scripts/auth/invite-investor.sh --lead-ref RS-... --role investor|operator --yes [--send]`
- Listado: `scripts/auth/list-users.sh --role investor|operator|admin`

`--role staff` se acepta solo como alias legacy de `operator` cuando aplica. La salida debe mostrar roles canónicos.

## Auditoría y verificación

Comprobaciones no destructivas en producción:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 jarvis-realstate '
  docker exec current-postgres-1 psql -U realstate -d realstate -c "
    select role::text, status::text, count(*)::int
    from app_users
    group by role, status
    order by role::text, status::text;
  "
'
```

No imprimir emails completos salvo que sea necesario y con autorización expresa. Usar conteos y referencias públicas.

## Rollback

No hay migración destructiva asociada a este modelo. Si una fila legacy `staff` causa problemas:

1. No convertir por SQL manual en producción sin plan.
2. Confirmar impacto con conteos por rol.
3. Corregir en código para normalizar a `operator` o preparar migración incremental si se decide eliminar `staff` del enum en una fase futura.
