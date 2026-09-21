---
name: scaffold-backend
description: "Scaffold a brand new Spring Boot microservice from core-springboot-template. Use when user asks to create, bootstrap, or scaffold a new backend service."
---

# Scaffold Backend Skill

Automation guide for creating a new Spring Boot service with standard layered architecture, OpenAPI configuration, Flyway migrations, and multi-agent setup.

## Usage Command

```bash
make scaffold SERVICE=NOMBRE PACKAGE=com.infosystem.nombre OUT=../nombre-backend
```

Or via direct Node execution:

```bash
node scripts/scaffold-new-backend.mjs --service NOMBRE --package com.infosystem.nombre --out ../nombre-backend
```

## Parameters
- `SERVICE`: Service identifier in UPPERCASE (e.g. `FARMACIA`, `INVENTARIO`, `NOTIFICACIONES`).
- `PACKAGE`: Java base package (e.g. `com.infosystem.farmacia`).
- `OUT`: Output relative or absolute directory path (e.g. `../farmacia-backend`).

## What it Generates
- Complete Spring Boot Maven structure (`pom.xml`, `application.yml`, Docker build setup).
- Clean 4-layer Java architecture (`controller`, `service`, `repository`, `model`, `exception`).
- Flyway migration script `V1__init_schema.sql`.
- Multi-agent rules and skills (`.agents/`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursorrules`, etc.).
- Automated contract export tests (`OpenApiExportTest`, `DbSchemaExportTest`, `DbContractTest`).
