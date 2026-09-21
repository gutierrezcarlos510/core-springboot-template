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
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
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

function copiarDirectorioTemplates(srcDir, targetJavaDir) {
  function escanear(dirActual) {
    const entradas = readdirSync(dirActual);
    for (const entrada of entradas) {
      const fullPath = join(dirActual, entrada);
      const relPath = relative(srcDir, fullPath);
      if (statSync(fullPath).isDirectory()) {
        escanear(fullPath);
      } else if (entrada.endsWith('.java.template')) {
        const destRel = relPath.replace('.template', '');
        const targetPath = join(targetJavaDir, destRel);
        const contenido = aplicarPlaceholders(readFileSync(fullPath, 'utf8'));
        escribir(targetPath, contenido);
      }
    }
  }
  escanear(srcDir);
}

function copiarPlano(srcDir, targetDir) {
  function escanear(dirActual) {
    for (const entrada of readdirSync(dirActual)) {
      const fullPath = join(dirActual, entrada);
      const relPath = relative(srcDir, fullPath);
      if (statSync(fullPath).isDirectory()) {
        escanear(fullPath);
      } else {
        escribir(join(targetDir, relPath), readFileSync(fullPath));
      }
    }
  }
  escanear(srcDir);
}

// 0. Configuración de agentes de IA (.agents/): reglas y skills universales sin vendor lock-in.
if (existsSync(join(raiz, 'templates/agents'))) {
  copiarPlano(join(raiz, 'templates/agents/rules'), join(destino, '.agents/rules'));
  copiarPlano(join(raiz, 'templates/agents/skills'), join(destino, '.agents/skills'));
} else if (existsSync(join(raiz, '.agents'))) {
  copiarPlano(join(raiz, '.agents'), join(destino, '.agents'));
}

// 1. Scripts genéricos: se copian tal cual (sin placeholders).
mkdirSync(join(destino, 'scripts'), { recursive: true });
for (const archivo of readdirSync(join(raiz, 'scripts'))) {
  if (!archivo.endsWith('.mjs') || archivo === 'scaffold-new-backend.mjs') continue;
  escribir(join(destino, 'scripts', archivo), readFileSync(join(raiz, 'scripts', archivo), 'utf8'));
}

// 2. JSON y contexto de agentes en la raíz.
escribir(join(destino, 'contracts.sources.json'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/contracts.sources.json.template'), 'utf8')));
escribir(join(destino, 'db-contract.json'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/db-contract.json.template'), 'utf8')));

const contexto = aplicarPlaceholders(readFileSync(join(raiz, 'templates/docs/CONTEXT.md.template'), 'utf8'));
const agentsGuide = existsSync(join(raiz, 'templates/docs/AGENTS.md.template'))
  ? aplicarPlaceholders(readFileSync(join(raiz, 'templates/docs/AGENTS.md.template'), 'utf8'))
  : contexto;

escribir(join(destino, 'CONTEXT.md'), contexto);
escribir(join(destino, '.agents/AGENTS.md'), agentsGuide);

// Puntos de entrada para compatibilidad multi-agente
const entrypointContent = `# Reglas de Agente de IA para {{SERVICIO}}

Este servicio utiliza las reglas de arquitectura estandarizadas ubicadas en [.agents/AGENTS.md](file://./.agents/AGENTS.md).
`;

escribir(join(destino, 'AGENTS.md'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, 'GEMINI.md'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, 'CLAUDE.md'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, '.cursorrules'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, '.windsurfrules'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, '.clinerules'), aplicarPlaceholders(entrypointContent));
escribir(join(destino, '.github/copilot-instructions.md'), aplicarPlaceholders(entrypointContent));

const memoria = aplicarPlaceholders(readFileSync(join(raiz, 'templates/docs/MEMORY.md.template'), 'utf8'));
escribir(join(destino, 'MEMORY.md'), memoria);

const contribuyendo = aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/CONTRIBUTING.md.template'), 'utf8'));
escribir(join(destino, 'CONTRIBUTING.md'), contribuyendo);

escribir(join(destino, '.env.example'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/.env.example.template'), 'utf8')));

// Copiar Makefile y scripts de setup
const makefile = readFileSync(join(raiz, 'Makefile'), 'utf8');
escribir(join(destino, 'Makefile'), makefile);

copiarPlano(join(raiz, 'scripts/.githooks'), join(destino, '.githooks'));

// Docker: arranque local sin instalar Postgres a mano.
escribir(join(destino, 'Dockerfile'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/Dockerfile.template'), 'utf8')));
escribir(join(destino, 'compose.yml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/compose.yml.template'), 'utf8')));
escribir(join(destino, 'compose.dev.yml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/compose.dev.yml.template'), 'utf8')));

// 3. Proyecto Spring Boot: pom, resources, main class y clases Java por capas.
const paqueteDir = paquete.replaceAll('.', '/');

escribir(join(destino, 'pom.xml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/pom.xml.template'), 'utf8')));
escribir(join(destino, 'src/main/resources/application.yml'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/application.yml.template'), 'utf8')));
escribir(join(destino, 'src/main/resources/db/migration/V1__init_schema.sql'),
  aplicarPlaceholders(readFileSync(join(raiz, 'templates/project/V1__init_schema.sql.template'), 'utf8')));

const dirMain = join(destino, 'src/main/java', paqueteDir);

// Copiar recursivamente todas las plantillas Java (config, controller, service, repository, model, dto, exception)
copiarDirectorioTemplates(join(raiz, 'templates/project'), dirMain);

// 4. Tests Java: van al paquete correspondiente.
const dirTest = join(destino, 'src/test/java', paqueteDir);
for (const archivo of readdirSync(join(raiz, 'templates/java'))) {
  const nombreClase = archivo.replace('.template', '');
  const subcarpeta = nombreClase.includes('OpenApi') ? 'openapi' : 'schema';
  const contenido = aplicarPlaceholders(readFileSync(join(raiz, 'templates/java', archivo), 'utf8'));
  escribir(join(dirTest, subcarpeta, nombreClase), contenido);
}

console.log(`\n✨ Backend '${servicio}' creado exitosamente en ${destino}.`);
console.log(`📌 Revisá ${destino}/AGENTS.md, CONTEXT.md y db-contract.json.`);
console.log(`💡 Para agregar nuevos módulos ejecuta: npm run scaffold:module -- --name TuModulo`);
