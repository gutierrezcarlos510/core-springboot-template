#!/usr/bin/env node
/**
 * Genera el contrato de endpoints de este backend leyendo sus controllers Spring.
 *
 *   node scripts/export-endpoints.mjs --service CORE
 *   node scripts/export-endpoints.mjs --service CORE --check   # CI: falla si el JSON está desactualizado
 *
 * Salida: docs/endpoints/{service}-endpoints.json
 * La salida es determinística (sin timestamps, orden estable) para que `--check`
 * y los diffs de git solo cambien cuando cambia la API real.
 *
 * El mismo archivo vive en core-backend-2026 y restobar-backend-2026: si lo
 * modificás en uno, copialo al otro.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const service = argValue('--service');
const checkOnly = args.includes('--check');
if (!service) {
  console.error('Uso: node scripts/export-endpoints.mjs --service <CORE|RESTOBAR|...> [--check]');
  process.exit(1);
}

const root = process.cwd();
const javaRoot = join(root, 'src/main/java');
const outFile = join(root, 'docs/endpoints', `${service.toLowerCase()}-endpoints.json`);

function listJavaFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listJavaFiles(full);
    return name.endsWith('Controller.java') ? [full] : [];
  });
}

function readPomVersion() {
  const pom = readFileSync(join(root, 'pom.xml'), 'utf8');
  // Primer <version> fuera de <parent>
  const sinParent = pom.replace(/<parent>[\s\S]*?<\/parent>/, '');
  return sinParent.match(/<version>([^<]+)<\/version>/)?.[1] ?? '0.0.0';
}

function readContextPath() {
  const yml = join(root, 'src/main/resources/application.yml');
  if (!existsSync(yml)) return '';
  return readFileSync(yml, 'utf8').match(/context-path:\s*([^\s#]+)/)?.[1] ?? '';
}

/** Rutas declaradas dentro de los paréntesis de una anotación @XxxMapping(...). */
function extractPaths(annotationArgs) {
  if (!annotationArgs) return [''];
  const limpio = annotationArgs.replace(
    /\b(produces|consumes|params|headers|method)\s*=\s*(\{[^}]*\}|"[^"]*"|[\w.]+)/g,
    ''
  );
  const paths = [...limpio.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return paths.length ? paths : [''];
}

function joinPath(base, sub) {
  const full = `/${base}/${sub}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  // {id:[0-9]+} -> {id}
  return full.replace(/\{(\w+):[^}]*\}/g, '{$1}');
}

const MAPPING_RE = /@(Get|Post|Put|Delete|Patch|Request)Mapping\b(?:\s*\(([^)]*)\))?/g;
const HANDLER_RE = /\b(?:public|protected)\s+(?:static\s+)?[^;{=]*?\s(\w+)\s*\(/;

function parseController(file) {
  const source = readFileSync(file, 'utf8');
  const classIdx = source.search(/\bclass\s+\w+/);
  if (classIdx < 0 || !/@(Rest)?Controller\b/.test(source)) return [];

  const header = source.slice(0, classIdx);
  const classMapping = [...header.matchAll(MAPPING_RE)].pop();
  const basePaths = classMapping ? extractPaths(classMapping[2]) : [''];
  const controller = source.slice(classIdx).match(/class\s+(\w+)/)[1];

  const body = source.slice(classIdx);
  const endpoints = [];
  for (const m of body.matchAll(MAPPING_RE)) {
    const [, kind, annArgs] = m;
    let methods;
    if (kind === 'Request') {
      methods = [...(annArgs ?? '').matchAll(/RequestMethod\.(\w+)/g)].map((x) => x[1]);
      if (!methods.length) methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    } else {
      methods = [kind.toUpperCase()];
    }

    const after = body.slice(m.index + m[0].length);
    const handler = after.match(HANDLER_RE)?.[1] ?? 'desconocido';

    for (const base of basePaths) {
      for (const sub of extractPaths(annArgs)) {
        const path = joinPath(base, sub);
        for (const method of methods) {
          endpoints.push({
            method,
            path,
            controller,
            handler,
            internal: /\/internal(\/|$)|Internal/.test(path + controller),
            pathParams: [...path.matchAll(/\{(\w+)\}/g)].map((p) => p[1]),
            source: relative(root, file)
          });
        }
      }
    }
  }
  return endpoints;
}

const endpoints = listJavaFiles(javaRoot)
  .flatMap(parseController)
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

// id estable: Controller(sin sufijo).handler — desambiguado si hay sobrecargas
const seen = new Map();
for (const ep of endpoints) {
  const base = `${ep.controller.replace(/Controller$/, '')}.${ep.handler}`;
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  ep.id = n === 1 ? base : `${base}#${n}`;
}

const contract = {
  schemaVersion: 1,
  service,
  version: readPomVersion(),
  basePath: readContextPath(),
  endpointCount: endpoints.length,
  endpoints: endpoints.map(({ id, method, path, pathParams, internal, controller, handler, source }) => ({
    id, method, path, pathParams, internal, controller, handler, source
  }))
};

const output = `${JSON.stringify(contract, null, 2)}\n`;

if (checkOnly) {
  const actual = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (actual !== output) {
    console.error(`❌ ${relative(root, outFile)} está desactualizado.`);
    console.error(`   Ejecutá: node scripts/export-endpoints.mjs --service ${service} y commiteá el resultado.`);
    process.exit(1);
  }
  console.log(`✅ Contrato ${service} al día (${endpoints.length} endpoints).`);
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, output);
  console.log(`✅ ${relative(root, outFile)} generado (${endpoints.length} endpoints, v${contract.version}).`);
}
