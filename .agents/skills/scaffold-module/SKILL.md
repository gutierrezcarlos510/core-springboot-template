---
name: scaffold-module
description: "Scaffold a new CRUD module inside an existing Spring Boot backend. Use when user asks to create, add, or scaffold a new entity, table, or CRUD module."
---

# Scaffold Module Skill

Automation guide for generating a new CRUD module inside an existing backend.

## Usage Command

```bash
make scaffold-module MODULE=Entidad TABLE=entidades
```

Or via direct Node execution:

```bash
node scripts/scaffold-module.mjs --name Entidad --table entidades
```

## Parameters
- `MODULE` / `--name`: Capitalized entity name (e.g. `Producto`, `Cliente`, `Venta`).
- `TABLE` / `--table`: Database table name (e.g. `productos`, `clientes`, `ventas`).

## What it Generates
- `Controller`: `{{MODULE}}Controller.java` with `@Operation`, `@Tag`, and standard endpoints (`GET /api/v1/{{table}}`, `POST`, `PUT`, `DELETE`).
- `Service`: `{{MODULE}}Service.java` with business logic and transactional methods.
- `Repository`: `{{MODULE}}Repository.java` using `JdbcClient` and text block SQL queries.
- `Model`: `{{MODULE}}.java` (record), `Create{{MODULE}}Request.java`, `Update{{MODULE}}Request.java`, `{{MODULE}}Response.java`.
- `Migration`: `V{N}__create_{{table}}_table.sql` with `COMMENT ON TABLE` and `COMMENT ON COLUMN`.
