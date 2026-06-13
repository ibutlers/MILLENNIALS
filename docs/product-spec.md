# Especificación de producto — Realstate

Realstate será una webapp inmobiliaria para presentar, consultar y gestionar oportunidades de real estate.

## Usuarios

- Visitantes interesados en comprar o alquilar propiedades.
- Operadores que gestionan inventario.
- Administradores del sistema.

## Alcance visible actual

La aplicación ya ofrece una fundación pública profesional para validar la experiencia de marca antes de conectar datos reales:

- landing responsive y mobile-first;
- navegación pública;
- hero con propuesta de valor;
- buscador visual de propiedades;
- selector comprar/alquilar, ubicación, tipo y precio máximo;
- sección de propiedades destacadas con datos mock realistas;
- sección de ventajas/servicios;
- CTA de contacto;
- footer completo;
- página visual 404 para rutas desconocidas;
- SEO básico sin canonical definitiva mientras no exista dominio estable.

## Alcance técnico actual

- API mínima con `/health` y `/api/health`.
- Despliegue con Docker Compose, Caddy y PostgreSQL interno.
- Pruebas unitarias, accesibilidad básica y Playwright.

## Fuera de alcance del hito actual

Autenticación real, panel administrativo, CRM, pagos, mapas, modelo de datos definitivo, migraciones, CRUD real, persistencia de leads y catálogo conectado a PostgreSQL.
