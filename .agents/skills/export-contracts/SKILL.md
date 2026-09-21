---
name: export-contracts
description: "Export OpenAPI specifications, Live DB Schema documentation, and Endpoint Contracts. Use when schema, endpoints, or contracts need updating."
---

# Export Contracts Skill

Automation guide for exporting live database schemas, OpenAPI specs, and endpoint contracts across backends.

## Usage Commands

### 1. Export OpenAPI Specification
```bash
mvn test -Dtest=OpenApiExportTest
```
Generates `docs/openapi.json` and `docs/openapi.yaml`.

### 2. Export Live Database Schema Documentation
```bash
node scripts/export-db-schema.mjs --service NOMBRE
```
Generates `docs/database/NOMBRE-schema.md` from Flyway migrations and table/column comments.

### 3. Export Endpoint Contracts
```bash
node scripts/export-endpoints.mjs --service NOMBRE
```
Generates `docs/endpoints/NOMBRE-endpoints.json`.

### 4. Sync Contracts with Core Backend
```bash
node scripts/sync-contracts.mjs
```
Synchronizes contract definition files with `core-backend`.
