# AGENTS.md — Reglas y Guía para Agentes de Inteligencia Artificial

Este archivo define las normas de arquitectura, estilo de código, flujos de trabajo y herramientas automatizadas para cualquier agente de IA que trabaje en `core-springboot-template` o en backends derivados de esta plantilla.

---

## 1. Reglas Generales y Filosofía
1. **Nunca escribir datos dinámicos a mano en la documentación:** La versión de Spring Boot, el número de columnas de una tabla o la lista de endpoints SE GENERAN AUTOMÁTICAMENTE. Los documentos en `docs/` se actualizan mediante scripts y tests.
2. **Respetar la arquitectura por capas:**
   - `controller`: Expone API REST, valida DTOs de entrada (`@Valid`), documenta con OpenAPI (`@Operation`, `@Tag`), delega a la capa `service`. No maneja SQL ni transacciones directamente.
   - `service`: Contiene la lógica de negocio, reglas de validación avanzadas, transacciones (`@Transactional`) y mapeo entre DTOs y modelos. Dispara excepciones de dominio (`ResourceNotFoundException`, `BusinessException`).
   - `repository`: Acceso a base de datos usando `JdbcClient` / `RowMapper`. Consultas SQL optimizadas en bloques de texto Java (`"""..."""`), mapeo seguro y sin lógica de negocio.
   - `model`: Modelos de dominio e inmutables (Java Records), DTOs de entrada (`*Request`), DTOs de salida (`*Response`) y sobres de respuesta (`ApiResponse<T>`). No existe carpeta `dto`, todo el modelo y contratos de datos viven en `model`.
   - `exception`: Manejador global de excepciones (`GlobalExceptionHandler`) que mapea todas las respuestas a `ApiResponse<T>`.
3. **Persistencia con `JdbcClient`:**
   - No usar ORMs pesados salvo requerimiento explícito.
   - Utilizar `JdbcClient` con parámetros nombrados (`:paramName`) o posicionales y `RowMapper` declarativos.

---

## 2. Comandos Frecuentes y Herramientas

| Tarea | Comando |
|---|---|
| Crear un nuevo backend completo | `node scripts/scaffold-new-backend.mjs --service NOMBRE --package com.infosystem.nombre --out ../nombre-backend` |
| Crear un nuevo módulo CRUD | `node scripts/scaffold-module.mjs --name Entidad --table entidades` (ejecutado en la raíz del backend) |
| Generar contrato de Endpoints | `node scripts/export-endpoints.mjs --service NOMBRE` |
| Generar especificación OpenAPI | `mvn test -Dtest=OpenApiExportTest` |
| Generar esquema de BD en Markdown | `node scripts/export-db-schema.mjs --service NOMBRE` |
| Sincronizar contratos con Core | `node scripts/sync-contracts.mjs` |

---

## 3. Convenciones de Base de Datos y Migraciones
- Toda nueva tabla o alteración se realiza vía migración Flyway en `src/main/resources/db/migration/V{N}__{descripcion}.sql`.
- **Comentarios obligatorios:** Cada tabla y cada columna DEBE incluir `COMMENT ON TABLE` y `COMMENT ON COLUMN`. Estos comentarios son extraídos automáticamente por `DbSchemaExportTest` para generar `docs/database/{service}-schema.md`.
- Usar tipos estándar de Postgres (`UUID` para PK, `TIMESTAMPTZ` para fechas con zona horaria, `VARCHAR`, `NUMERIC`, `BOOLEAN`).

---

## 4. Estándar de Respuestas API
Todas las respuestas REST deben ser envueltas en `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Operación realizada con éxito",
  "data": { ... },
  "timestamp": "2026-09-17T20:00:00Z",
  "error": null
}
```

En caso de error:

```json
{
  "success": false,
  "message": "Recurso no encontrado",
  "data": null,
  "timestamp": "2026-09-17T20:00:00Z",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "details": ["El elemento con ID 123 no existe"]
  }
}
```

---

## 5. Contrato con Core Backend (`public`)
- Se prohíbe la consulta directa a las tablas físicas del esquema `public` de `core-backend`.
- Se deben consumir las vistas de contrato publicadas: `public.core_v_*`.
- Declarar las vistas y columnas utilizadas en `db-contract.json`.
- Verificar el contrato mediante `DbContractTest`.
