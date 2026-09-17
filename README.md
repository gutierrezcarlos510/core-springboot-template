# core-springboot-template

Plantilla + herramientas compartidas para los backends Spring Boot de infosystem
(core-backend-2026, restobar-backend-2026, y los que se sumen). Resuelve dos cosas:

1. **Un backend nuevo arranca ya con documentación viva**, no con un `CONTEXT.md` que
   alguien escribe a mano y queda desactualizado en la primera migración (pasó en
   restobar-backend: versión de Spring Boot y columnas de tabla copiadas a mano, ninguna
   de las dos coincidía con el código real).
2. **Los scripts y workflows de CI no se copian entre repos.** Hoy `export-endpoints.mjs`
   vive duplicado en core y restobar con la nota "si lo modificás en uno, copialo al otro".
   Acá vive una vez; cada backend invoca una versión (`@v1`) del workflow reutilizable.

## Uso rápido: crear un backend nuevo

```bash
git clone git@github.com:gutierrezcarlos510/core-springboot-template.git
cd core-springboot-template
node scripts/scaffold-new-backend.mjs \
  --service FARMACIA \
  --package com.infosystem.farmacia \
  --out ../farmacia-backend
cd ../farmacia-backend
git init && mvn compile   # ya compila: pom.xml, migración V1, Application, controller de ejemplo
```

Esto deja un proyecto Spring Boot que **arranca y compila**, no solo carpetas vacías:

- `pom.xml` — Spring Boot 4.1.0, Flyway, JDBC, Security, springdoc, Lombok (mismas
  versiones que ya corren en producción en core y restobar).
- `src/main/resources/application.yml` — datasource por variables de entorno, Flyway
  habilitado, OpenAPI deshabilitado en runtime.
- `src/main/resources/db/migration/V1__init_schema.sql` — tabla `ejemplo` con
  `COMMENT ON` en cada columna (así `docs/database/{service}-schema.md` sale con
  descripciones desde el primer commit). Borrarla al definir el esquema real.
- `Application.java`, `EjemploController.java` (JdbcClient + `@Operation`, para que
  `OpenApiExportTest` tenga algo que exportar), `SecurityConfig.java` (todo público —
  reemplazar antes de producción, ver nota en el archivo).
- `CONTEXT.md` / `AGENTS.md` (idénticos) — apuntan a los archivos generados, no
  contienen datos concretos. Es la regla que falta en el CONTEXT.md viejo de restobar:
  **el contexto escrito a mano explica el porqué y la arquitectura; los datos concretos
  salen siempre de un archivo generado.**
- `contracts.sources.json` + `db-contract.json` — el mecanismo de contrato con
  `public.*` de core-backend (vistas `core_v_*`), ver más abajo.
- Tests `OpenApiExportTest`, `DbSchemaExportTest`, `DbContractTest` en `src/test/java`.

El script no pisa archivos que ya existan en destino — correlo de nuevo después de
editar algo a mano y no perdés el cambio.

## Qué documentación se genera (y nunca se edita a mano)

| Archivo | Generador | Contiene |
|---|---|---|
| `docs/endpoints/{service}-endpoints.json` | `node scripts/export-endpoints.mjs --service X` | id estable, método y ruta de cada endpoint |
| `docs/openapi/{service}-openapi.json` | `mvn test -Dtest=OpenApiExportTest` | parámetros, body, respuesta, validaciones, errores |
| `docs/database/{service}-schema.md` | `mvn test -Dtest=DbSchemaExportTest` (o `node scripts/export-db-schema.mjs`) | tablas, columnas, tipos, nulabilidad, defaults, comentarios |
| `docs/external/core/*` | `node scripts/sync-contracts.mjs` | esquema `public` y OpenAPI de core-backend, copiados desde su checkout |

Cada uno tiene `--check` (o `-D*.check=true`) para CI: falla si el archivo commiteado no
coincide con lo que generaría el código actual.

## El contrato con `public` de core-backend

Un backend cliente que lee tablas de `public` con SQL directo (como hoy hace restobar
con `core_usuarios`, `core_instancias`) debe:

1. Leer las vistas `core_v_*` que core-backend expone como contrato estable
   (`docs/database/core-schema.md`, sección "Vistas"), **nunca las tablas reales**.
2. Declarar qué vistas y columnas usa en `db-contract.json`.
3. Correr `DbContractTest` contra la base de dev real (no un esquema efímero: necesita
   que las vistas de core ya estén aplicadas) — si core rompe algo declarado sin avisar,
   este test falla antes de que llegue a producción.

Ver `core-restobar-backend/db-contract.json` y su `docs/PENDIENTES.md` para el caso real
(declarado, con el test corriendo en CI; migrar las queries de tablas reales a las vistas
sigue pendiente ahí).

## Scripts y workflows de CI reutilizables

- `scripts/export-endpoints.mjs` — genera `docs/endpoints/{service}-endpoints.json` desde
  los controllers Spring (busca `*Controller.java`, no depende del paquete).
- `scripts/openapi-coverage.mjs` — reporte de qué falta documentar con `@Operation`/`@Schema`.
- `scripts/export-db-schema.mjs` — genera `docs/database/{service}-schema.md` aplicando las
  migraciones Flyway desde cero contra un Postgres local descartable (requiere `psql` y
  permiso `CREATEDB`; se niega a correr si `PGHOST` no es `localhost`).
- `scripts/sync-contracts.mjs` — trae `docs/external/core/*` desde un checkout de core-backend,
  según `contracts.sources.json`.
- `scripts/scaffold-new-backend.mjs` — instala todo lo anterior (plantillas incluidas) en un
  backend nuevo.
- `.github/workflows/*.yml` — versiones `workflow_call` de lo anterior:

  ```yaml
  jobs:
    contrato:
      uses: gutierrezcarlos510/core-springboot-template/.github/workflows/contrato-endpoints.yml@v1
      with:
        service: FARMACIA
      secrets:
        maven-packages-token: ${{ secrets.MAVEN_PACKAGES_TOKEN }}

    esquema:
      uses: gutierrezcarlos510/core-springboot-template/.github/workflows/esquema-bd.yml@v1
      with:
        service: FARMACIA

    contrato-core:
      uses: gutierrezcarlos510/core-springboot-template/.github/workflows/sync-contracts.yml@v1
      secrets:
        core-repo-token: ${{ secrets.CORE_REPO_TOKEN }}
  ```

  El backend necesita el código fuente de los scripts y tests instalado localmente (lo hace
  `scaffold-new-backend.mjs`); el workflow reutilizable solo orquesta el CI.

## Versionado

Etiquetar `v1`, `v2`, ... al cambiar un workflow de forma incompatible. Los backends fijan la
versión que usan (`@v1`) y suben deliberadamente, no automáticamente — así una mejora no rompe
a todos a la vez.

## Para agentes de IA

Si estás armando un backend nuevo o le estás dando contexto a otro asistente sobre uno
existente: el `CONTEXT.md`/`AGENTS.md` de ese backend es la guía; nunca copies de acá
versiones, columnas ni endpoints — están desactualizados apenas los lees. Regenerá con
los comandos de la tabla de arriba y leé el archivo generado.

## Backends que lo usan

- restobar-backend-2026 — usa el patrón (scripts propios + `DbSchemaExportTest`/`DbContractTest`
  ya instalados), pendiente de migrar a `workflow_call` en vez de sus copias locales de
  `export-endpoints.mjs`/`openapi-coverage.mjs`.
- core-backend-2026 — tiene su propio `export-db-schema.mjs` (Node, mismo patrón), pendiente
  de migrar a `workflow_call`.
