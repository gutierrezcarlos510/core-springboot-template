# core-springboot-template

> Plantilla de arquitectura empresarial + herramientas automatizadas para backends Spring Boot 4.x / Java 17 LTS en Infosystem.

Esta plantilla resuelve los problemas centrales del desarrollo de microservicios:

1. **Documentación viva desde el primer commit:** La versión de Java, la especificación OpenAPI, la lista de endpoints y la estructura de la base de datos se exportan automáticamente desde el código ejecutable y las migraciones. Cero documentación desactualizada.
2. **Arquitectura por capas limpia y consistente:** Estructura modular estandarizada que coincide con `core-backend` (Controller -> Service -> Repository con `JdbcClient` -> Model -> Global Exception Handling). Sin carpeta `dto` separada: todo el modelo y contratos de datos residen en `model/`.
3. **Scaffolding instantáneo mediante CLI:** Generación de proyectos completos y módulos CRUD con un solo comando.
4. **Integración con Inteligencia Artificial (Antigravity):** Configuración preinstalada de `.agents/AGENTS.md` para garantizar que los asistentes de IA sigan las convenciones exactas del proyecto.

---

## 🛠️ Stack Tecnológico y Dependencias

- **JDK:** Java 17 LTS (`maven.compiler.release = 17`)
- **Framework:** Spring Boot 4.1.0 (`spring-boot-starter-parent`)
- **Persistencia:** PostgreSQL (`postgresql`) + Spring JDBC (`spring-boot-starter-jdbc`) + Migraciones DDL (`flyway-database-postgresql`)
- **Seguridad:** Spring Security (`spring-boot-starter-security`) + JWT (`java-jwt` 4.4.0)
- **Validación:** Jakarta Validation (`spring-boot-starter-validation`)
- **Documentación de API:** Springdoc OpenAPI 3.0 (`springdoc-openapi-starter-webmvc-ui` 2.8.5)
- **Utilidades:** Project Lombok (`lombok` 1.18.36)

---

## 🚀 Uso Rápido

### 1. Crear un backend nuevo completo

```bash
git clone git@github.com:gutierrezcarlos510/core-springboot-template.git
cd core-springboot-template
npm install

# Generar nuevo servicio (ejemplo: FARMACIA)
npm run scaffold -- \
  --service FARMACIA \
  --package com.infosystem.farmacia \
  --out ../farmacia-backend

cd ../farmacia-backend
git init && mvn compile
```

Esto entrega un proyecto listo que **compila y arranca inmediatamente**, con:

- `pom.xml` — Spring Boot 4.1.0 (Java 17), Spring JDBC, Flyway, Springdoc OpenAPI, Lombok, PostgreSQL.
- `src/main/resources/application.yml` — Configuración de datasource por variables de entorno.
- `src/main/resources/db/migration/V1__init_schema.sql` — Migración DDL Flyway con comentarios SQL `COMMENT ON` listos para extracción de documentación.
- **Estructura por capas completa:** `controller/`, `service/`, `repository/`, `model/`, `exception/`, `config/`.
- `AGENTS.md` y `.agents/AGENTS.md` — Reglas contextuales para asistentes de IA.
- Tests `OpenApiExportTest`, `DbSchemaExportTest` y `DbContractTest`.

---

### 2. Generar un nuevo módulo CRUD en un proyecto existente

Dentro del backend generado (o en este template), puedes crear un módulo completo ejecutando:

```bash
npm run scaffold:module -- --name Producto --table productos
```

Este comando detecta automáticamente el paquete base leyendo `Application.java` y genera de forma determinista:

- 📄 `model/ProductoRequest.java` (Validaciones Jakarta + OpenAPI `@Schema`)
- 📄 `model/ProductoResponse.java` (Record inmutable de respuesta)
- 📄 `model/Producto.java` (Modelo de dominio)
- 📄 `repository/ProductoRepository.java` (Persistencia SQL optimizada con `JdbcClient` y Text Blocks multilínea)
- 📄 `service/ProductoService.java` (Lógica de negocio, `@Transactional` y excepciones)
- 📄 `controller/ProductoController.java` (Endpoints RESTful GET/POST/PUT/DELETE)
- 📜 `src/main/resources/db/migration/V{timestamp}__create_productos_table.sql` (Migración Flyway DDL con `COMMENT ON`)

---

## 🏗️ Arquitectura por Capas (`core-backend`)

El proyecto sigue una estricta separación de responsabilidades idéntica a `core-backend`:

```
src/main/java/com/infosystem/servicio/
├── config/
│   ├── OpenApiConfig.java          # Configuración de OpenAPI 3.0 / Swagger UI
│   └── SecurityConfig.java          # Configuración de Spring Security & CORS
├── controller/
│   └── EjemploController.java      # Endpoints REST, @Valid y anotaciones OpenAPI
├── service/
│   └── EjemploService.java         # Lógica de negocio, @Transactional y reglas
├── repository/
│   └── EjemploRepository.java      # Consultas SQL con JdbcClient y RowMapper
├── model/
│   ├── ApiResponse.java            # Wrapper universal de respuesta REST
│   ├── Ejemplo.java                # Entidad/Modelo de dominio inmutable (Record)
│   ├── EjemploRequest.java         # DTO de entrada con validaciones
│   └── EjemploResponse.java        # DTO de salida
└── exception/
    ├── ResourceNotFoundException.java # Excepción 404
    ├── BusinessException.java         # Excepción 400
    └── GlobalExceptionHandler.java    # ControllerAdvice centralizado
```

---

## 📊 Documentación Viva (Auto-Generada)

Cualquier cambio en controladores o migraciones se sincroniza ejecutando los scripts correspondientes:

| Archivo Generado                          | Comando                                   | Descripción                                                                           |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/endpoints/{service}-endpoints.json` | `npm run export:endpoints -- --service X` | Lista determinística de endpoints, métodos HTTP, controladores y parámetros.          |
| `docs/openapi/{service}-openapi.json`     | `mvn test -Dtest=OpenApiExportTest`       | Especificación completa OpenAPI 3.0 (parámetros, schemas, respuestas).                |
| `docs/database/{service}-schema.md`       | `npm run export:schema -- --service X`    | Documentación Markdown del esquema BD extraída de los comentarios SQL (`COMMENT ON`). |
| `docs/external/core/*`                    | `npm run sync:contracts`                  | Esquema y OpenAPI sincronizados desde `core-backend`.                                 |

---

## 🔒 Contrato con `public` de `core-backend`

Los microservicios que leen información del núcleo (ej: usuarios, empresas, instancias) **nunca consultan las tablas físicas de `core`**.

1. Se consumen únicamente las vistas de contrato: `public.core_v_*`.
2. Las vistas requeridas se declaran en `db-contract.json`.
3. El test `DbContractTest` verifica en CI que las vistas sigan disponibles y compatibles.

---

## 🛠️ Comandos Frecuentes

```bash
# Crear un nuevo backend desde cero
npm run scaffold -- --service NOMBRE --package com.infosystem.nombre --out ../nombre-backend

# Scaffold de módulo dentro de un backend
npm run scaffold:module -- --name Categoria --table categorias

# Exportar contrato de endpoints
npm run export:endpoints -- --service NOMBRE

# Exportar OpenAPI especificación
mvn test -Dtest=OpenApiExportTest

# Exportar documentación de Base de Datos
npm run export:schema -- --service NOMBRE

# Sincronizar contratos con core-backend
npm run sync:contracts
```

---

## 📖 Guías Adicionales

- 📘 [Guía de Arquitectura y Desarrollo Senior](file:///home/ron/Proyectos/java/core-springboot-template/docs/DEVELOPER_GUIDE.md) — Documentación técnica avanzada sobre patrones de diseño, persitencia con `JdbcClient`, manejo de excepciones, contratos con `core-backend` y dependencias.
- 🤖 [Guía de Agentes de IA (`.agents/AGENTS.md`)](file:///home/ron/Proyectos/java/core-springboot-template/.agents/AGENTS.md) — Reglas y normas para asistentes de Inteligencia Artificial.
