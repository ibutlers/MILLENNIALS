# Arquitectura de proveedores (ports & adapters)

## Visión general

Cada integración externa sigue el patrón **puerto → adaptador**:

- **Puerto:** Interfaz TypeScript en `apps/api/src/providers/interfaces.ts`
  que define solo las operaciones necesarias para el producto actual.
- **Adaptador:** Implementación concreta. Actualmente solo existen los
  adaptadores `Disabled*` en `apps/api/src/providers/disabled.ts`.

## Proveedores definidos

| Puerto | Operaciones | Adaptador actual |
|--------|-------------|------------------|
| `EmailProvider` | `send`, `health` | `DisabledEmailProvider` |
| `StorageProvider` | `save`, `getSecureUrl`, `delete`, `metadata`, `health` | `DisabledStorageProvider` |
| `KycProvider` | `initiate`, `checkStatus`, `interpretEvent`, `health` | `DisabledKycProvider` |
| `SignatureProvider` | `createRequest`, `checkStatus`, `interpretEvent`, `health` | `DisabledSignatureProvider` |
| `PaymentsProvider` | `createOperation`, `checkStatus`, `cancel`, `interpretEvent`, `health` | `DisabledPaymentsProvider` |

## Comportamiento de los adaptadores desactivados

Cada `Disabled*Provider`:

- **Nunca simula éxito.** Cualquier llamada lanza un error tipado con código `provider_not_configured`.
- **No genera identificadores falsos.** No hay `providerReference` inventadas.
- **No crea estados ficticios.** No se marca KYC como "verificado", pagos como "completado", etc.
- **No expone rutas webhook.** En producción no hay endpoints que reciban callbacks de proveedores sin verificación de firma.
- **No incluye SDKs ni credenciales.** Las dependencias reales se añadirán solo cuando se active el proveedor.

## Selección

`apps/api/src/providers/config.ts` centraliza la selección. Las variables de entorno `PROVIDER_*` controlan qué adaptador se instancia:

```bash
PROVIDER_EMAIL=disabled      # actualmente el único valor disponible
PROVIDER_STORAGE=disabled
PROVIDER_KYC=disabled
PROVIDER_SIGNATURE=disabled
PROVIDER_PAYMENTS=disabled
```

Para añadir un proveedor real:

1. Implementar la interfaz correspondiente
2. Registrar la factory en `config.ts`
3. Establecer `PROVIDER_*=nombre` en el entorno

El `buildApp` de Fastify recibe opcionalmente un `ProviderSet` para testing (inyección de dependencias).
