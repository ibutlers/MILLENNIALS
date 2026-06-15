# Baseline de migraciones — MILLENNIALS CONSTRUYEN | CAPITAL

## Principio inmutable

La migración `0001_baseline_definitive.sql` es **definitiva e inmutable**. No debe modificarse nunca después de haber sido aplicada. Cualquier cambio futuro debe hacerse mediante una nueva migración (`0002_*.sql`, `0003_*.sql`, etc.).

## Responsabilidad del runner

El runner de migraciones (`apps/api/src/db/migrate.ts`) es el único propietario de la tabla `schema_migrations`:

- Crea `schema_migrations` con PRIMARY KEY (id) antes de aplicar cualquier migración
- Adquiere advisory lock para impedir dos migradores simultáneos
- Ejecuta cada migración dentro de una transacción
- Inserta la fila de migración solo después de aplicar correctamente el SQL
- Hace rollback completo ante cualquier error
- Detecta checksum diferente en una migración ya aplicada y falla
- En segunda ejecución: no-op limpio (skipped) con código 0

## Baseline SQL (0001_baseline_definitive.sql)

- **27 tablas de dominio** (schema_migrations es propiedad del runner)
- **19 tipos ENUM**
- **31 foreign keys**
- **7 triggers** (`*_set_updated_at`)
- **73 índices**
- **No contiene** `INSERT INTO schema_migrations`
- **No usa** `IF NOT EXISTS` en tablas/índices (determinístico, ejecutar una sola vez)
- **Solo usa** `CREATE EXTENSION IF NOT EXISTS` para pgcrypto (bootstrap técnicamente justificado)
- Todo el DDL es compatible con una transacción PostgreSQL

## Checksum

```
Baseline SHA-256: 2e4fab57f6e5227444a7d881243b8d63cddf1a2369ac5c942f1ed0e96fade1f8
```

El runner calcula SHA-256 del archivo y lo compara con el valor almacenado. Si difieren, **lanza error** — no repara automáticamente.

## Prohibiciones

- ❌ Insertar manualmente en `schema_migrations`
- ❌ Modificar `0001_baseline_definitive.sql` después de aplicada
- ❌ Forzar checksums
- ❌ Usar `CREATE TABLE IF NOT EXISTS` en migraciones
- ❌ Usar `DROP TRIGGER IF EXISTS` para ocultar estados parciales
- ❌ Usar `ON CONFLICT DO NOTHING` para esconder errores estructurales
- ❌ Ejecutar dos migradores simultáneamente

## Procedimiento de reinicialización

Si se necesita recrear la base desde cero:

1. Backup completo: `pg_dump -Fc -f backup.dump`
2. Renombrar base antigua: `ALTER DATABASE realstate RENAME TO realstate_broken_YYYYMMDD;`
3. Crear base nueva: `CREATE DATABASE realstate OWNER realstate;`
4. Ejecutar runner: `pnpm db:migrate`
5. Ejecutar seed: `DEMO_SEED_ENABLED=true pnpm db:seed`
6. Verificar: `SELECT * FROM schema_migrations;` — exactamente 1 fila

## Rollback

No hay rollback automático. El procedimiento es:

1. Restaurar backup: `pg_restore -d realstate backup.dump`
2. Verificar esquema y datos

## Seed demo

El seed es idempotente (puede ejecutarse múltiples veces). Usa `ON CONFLICT (slug) DO UPDATE` para las oportunidades y `DELETE + INSERT` para sub-entidades. Solo se ejecuta si `DEMO_SEED_ENABLED=true`.
