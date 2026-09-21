---
name: spring-jdbc
description: Guía y mejores prácticas para acceso a datos con Spring JDBC y JdbcTemplate en aplicaciones Spring Boot multi-inquilino. Incluye mapeo de filas a Java Records (RowMapper con lambdas), consultas SQL nativas parametrizadas, delegación de claves y fechas a PostgreSQL (RETURNING id, fecha_registro), optimización de escrituras (Single-Select on Write), paginación dinámica (DynamicPaginationService) y transaccionalidad declarativa. Use when you need to write or review programmatic JDBC with Spring or JdbcTemplate.
license: Apache-2.0
metadata:
  version: 2.0.0
  author: Juan Antonio Breña Moral / Core Backend Team
---
# Spring JDBC & JdbcTemplate Patterns (Core Multi-Tenant)

Aplica las directrices de Spring JDBC y `JdbcTemplate` para garantizar un acceso a datos de alto rendimiento, seguro y 100% compatible con el enrutamiento dinámico multi-inquilino (`TenantRoutingDataSource`) del proyecto.

## Capacidades y Temas Cubiertos

- **JdbcTemplate y SQL Nativo**: Control total sobre el esquema `public` y los esquemas de inquilino sin ORMs pesados (Regla 2).
- **Mapeo a Java Records**: Uso de `RowMapper` con lambdas explícitas `(rs, rowNum) -> new Record(...)` (Reglas 22 y 24).
- **Delegación a PostgreSQL (Regla 9)**: Prohibido generar IDs o fechas manualmente en Java. Usar cláusula `RETURNING id, fecha_registro` en las inserciones.
- **Single-Select on Write (Regla 15)**: En actualizaciones y borrado lógico (`estado = 'INACTIVO'`), no invocar `buscarPorId` previo. Ejecutar directamente `jdbcTemplate.update()` y validar que `filasAfectadas > 0`; si es 0, lanzar `RecursoNoEncontradoException`.
- **Paginación Dinámica (Regla 17)**: Integración con `DynamicPaginationService.ejecutarConsulta()`. El parámetro `ordenPorDefecto` debe ser estrictamente el nombre de la columna (ej. `"fecha_registro"`), sin `"DESC"`.
- **SQL Parametrizado**: Prevención total de inyecciones SQL usando siempre parámetros posicionales (`?`) o nombrados (`NamedParameterJdbcTemplate`).
- **Transaccionalidad (Regla 18)**: `@Transactional` a nivel de clase de servicio y `@Transactional(readOnly = true)` en métodos de solo lectura.
- **Manejo Seguro de Excepciones**: Captura de `DataAccessException` (`DuplicateKeyException`, `EmptyResultDataAccessException`) y mapeo a excepciones de dominio sin divulgar IDs al cliente (Regla 8.1).

---

## Restricciones y Reglas Críticas del Proyecto

Antes de aplicar cualquier cambio de persistencia:

- **COMPILACIÓN OBLIGATORIA**: Ejecutar `mvn compile` o `./mvnw compile` antes y después de cualquier refactorización.
- **NO FQCN INLINE**: Siempre importar clases en la cabecera (Regla 5).
- **BORRADO LÓGICO**: Nunca usar `DELETE FROM` en tablas maestras; usar `UPDATE ... SET estado = 'INACTIVO'` (Regla 3).
- **CONSTRUCTORES COMPACTOS**: Validar precondiciones de estado en constructores compactos de los Records (Regla 16).

---

## Cuándo usar este skill

- Escribir o refactorizar repositorios basados en `JdbcTemplate`.
- Implementar consultas SQL nativas, filtros dinámicos o paginación.
- Revisar vulnerabilidades de inyección SQL o problemas de límites transaccionales.
- Mapear consultas complejas a Java Records inmutables.

---

## Referencias Técnicas Adicionales

Para ejemplos detallados de código, transacciones avanzadas y patrones de prueba (`@JdbcTest`), consultar [references/311-frameworks-spring-jdbc.md](references/311-frameworks-spring-jdbc.md).
