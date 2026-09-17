#!/usr/bin/env node
/**
 * Instala las plantillas de este repo en un backend nuevo (o existente), reemplazando
 * los placeholders por los datos reales del servicio.
 *
 *   node scripts/scaffold-new-backend.mjs \
 *     --service FARMACIA \
 *     --package com.infosystem.farmacia \
 *     --out ../farmacia-backend
 *
 * Placeholders reemplazados en cada archivo copiado:
 *   {{SERVICIO}}  -> FARMACIA               (mayúsculas, para --service en los scripts)
 *   {{service}}   -> farmacia               (minúsculas, para nombres de archivo)
 *   {{PACKAGE}}   -> com.infosystem.farmacia
 *
 * Qué copia:
 *   scripts/export-endpoints.mjs, openapi-coverage.mjs, export-db-schema.mjs,
 *   sync-contracts.mjs               -> <out>/scripts/            (sin placeholders, genéricos)
 *   templates/contracts.sources.json.template -> <out>/contracts.sources.json
 *   templates/db-contract.json.template       -> <out>/db-contract.json
 *   templates/docs/CONTEXT.md.template        -> <out>/CONTEXT.md y <out>/AGENTS.md
 *   templates/java/*.template                 -> <out>/src/test/java/<paquete>/<nombre>.java
 *   templates/project/pom.xml.template         -> <out>/pom.xml
 *   templates/project/application.yml.template -> <out>/src/main/resources/application.yml
 *   templates/project/V1__init_schema.sql.template -> <out>/src/main/resources/db/migration/V1__init_schema.sql
 *   templates/project/Application.java.template    -> <out>/src/main/java/<paquete>/Application.java
 *   templates/project/EjemploController.java.template -> <out>/src/main/java/<paquete>/controller/EjemploController.java
 *   templates/project/SecurityConfig.java.template    -> <out>/src/main/java/<paquete>/config/SecurityConfig.java
 *   templates/project/.env.example.template    -> <out>/.env.example
 *
 * No sobrescribe archivos que ya existan en destino (avisa y sigue).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const servicio = valor('service');
const paquete = valor('package');
const destino = valor('out');

if (!servicio || !paquete || !destino) {
  console.error('Uso: node scripts/scaffold-new-backend.mjs --service FARMACIA --package com.infosystem.farmacia --out ../farmacia-backend');
  process.exit(1);
}

const placeholders = {
  '{{SERVICIO}}': servicio.toUpperCase(),
  '{{service}}': servicio.toLowerCase(),
  '{{PACKAGE}}': paquete,
};

function aplicarPlaceholders(texto) {
  return Object.entries(placeholders).reduce((t, [clave, val]) => t.replaceAll(clave, val), texto);
}

function escribir(destinoAbs, contenido) {
  if (existsSync(destinoAbs)) {
    console.log(`= ya existe, no se pisa: ${destinoAbs}`);
    return;
  }
  mkdirSync(dirname(destinoAbs), { recursive: true });
  writeFileSync(destinoAbs, contenido);
  console.log(`+ ${destinoAbs}`);
}

// 1. Scripts genéricos: se copian tal cual (sin placeholders).
mkdirSync(join(destino, 'scripts'), { recursive: true });
for (const archivo of readdirSync(join(raiz, 'scripts'))) {
  if (!archivo.endsWith('.mjs') || archivo === 'scaffold-new-backend.mjs') continue;
  escribir(join(destino, 'scripts', archivo), readFileSync(join(raiz, 'scripts', archivo), 'utf8'));
}

// 2. JSON y contexto de agentes en la raíz. AGENTS.md y CONTEXT.md quedan idénticos:
//    distintos asistentes buscan uno u otro nombre por convención.
escribir(join(destino, 'contracts.sources.json'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/contracts.sources.json.template'), 'utf8')));
escribir(join(destino, 'db-contract.json'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/db-contract.json.template'), 'utf8')));
const contexto = aplicarPlaceholders(readFileSync(join(raiz, 'templates/docs/CONTEXT.md.template'), 'utf8'));
escribir(join(destino, 'CONTEXT.md'), contexto);
escribir(join(destino, 'AGENTS.md'), contexto);
escribir(join(destino, '.env.example'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/.env.example.template'), 'utf8')));

// 3. Proyecto Spring Boot: pom, resources, main class, controller y security de ejemplo.
const paqueteDir = paquete.replaceAll('.', '/');

escribir(join(destino, 'pom.xml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/pom.xml.template'), 'utf8')));
escribir(join(destino, 'src/main/resources/application.yml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/application.yml.template'), 'utf8')));
escribir(join(destino, 'src/main/resources/db/migration/V1__init_schema.sql'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/V1__init_schema.sql.template'), 'utf8')));

const dirMain = join(destino, 'src/main/java', paqueteDir);
escribir(join(dirMain, 'Application.java'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/Application.java.template'), 'utf8')));
escribir(join(dirMain, 'controller/EjemploController.java'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/EjemploController.java.template'), 'utf8')));
escribir(join(dirMain, 'config/SecurityConfig.java'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/SecurityConfig.java.template'), 'utf8')));

// 4. Tests Java: van al paquete correspondiente (com.infosystem.farmacia -> com/infosystem/farmacia).
const dirTest = join(destino, 'src/test/java', paqueteDir);
for (const archivo of readdirSync(join(raiz, 'templates/java'))) {
  const nombreClase = archivo.replace('.template', ''); // OpenApiExportTest.java
  const subcarpeta = nombreClase.includes('OpenApi') ? 'openapi' : 'schema';
  const contenido = aplicarPlaceholders(readFileSync(join(raiz, 'templates/java', archivo), 'utf8'));
  escribir(join(dirTest, subcarpeta, nombreClase), contenido);
}

console.log(`\nListo. Revisá ${destino}/CONTEXT.md, AGENTS.md y db-contract.json (quedaron con datos de ejemplo).`);
console.log('Falta a mano: workflows de CI (copiar y editar de otro backend o invocar los workflow_call de este repo)');
console.log('y borrar EjemploController/V1__init_schema.sql cuando definas el esquema real.');
