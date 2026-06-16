# Arquitectura de contratos compartidos

## Principio

`packages/contracts` contiene los schemas Zod y tipos TypeScript que definen la
forma canónica de cada respuesta HTTP. Tanto la API como el frontend importan
exactamente los mismos contratos.

## Estructura

```
packages/contracts/src/
├── errors.ts          # errorResponseSchema, paginationSchema, ProviderErrorCode
├── auth.ts            # userResponseSchema, login/register/verify schemas
├── opportunities.ts   # opportunitySummarySchema, opportunityDetailSchema
├── providers.ts       # Schemas de health, email, storage, KYC, firma, pagos
└── index.ts           # Barrel export
```

## Reglas

1. **Una sola forma canónica por respuesta.** Si un endpoint devuelve un usuario,
   tanto API como Web usan `userResponseSchema`.
2. **Sin parsers duplicados.** No se permite redefinir schemas Zod o tipos en
   `apps/api/src` o `apps/web/src` que ya existan en `packages/contracts`.
3. **Sin compatibilidad silenciosa.** Si un contrato cambia y rompe la
   compatibilidad, ambos lados deben actualizarse simultáneamente. No se
   aceptan `catch` silenciosos que ignoren errores de parseo.
4. **Sin `any` en fronteras HTTP nuevas.** Todo endpoint nuevo debe tener su
   response schema en `packages/contracts`. Si un campo es opaco, usar
   `z.record(z.string(), z.unknown())`.
5. **Build integrado.** `pnpm build` compila contracts primero (orden de
   dependencias manejado por pnpm workspaces), luego API y Web pueden importar
   de `@realstate/contracts`.

## Migración desde schemas locales

Los schemas existentes en `apps/api/src/auth/schemas.ts` y
`apps/api/src/opportunities/schemas.ts` son funcionalmente equivalentes a los
de `packages/contracts`. En un hito futuro se reemplazarán las importaciones
internas de la API para usar exclusivamente `@realstate/contracts`, eliminando
la duplicación sin romper compatibilidad.
