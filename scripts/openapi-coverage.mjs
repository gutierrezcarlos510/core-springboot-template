#!/usr/bin/env node
/**
 * Reporte de cobertura de documentación del OpenAPI generado.
 *
 *   node scripts/openapi-coverage.mjs --service CORE            # resumen por tag/controller
 *   node scripts/openapi-coverage.mjs --service CORE --pendientes  # además lista qué falta
 *
 * Mide lo que springdoc NO puede inferir y requiere anotación humana:
 * - summary (@Operation)
 * - schema de respuesta (ResponseEntity<?> lo pierde)
 * El mismo archivo vive en todos los backends.
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const service = args[args.indexOf('--service') + 1];
const verPendientes = args.includes('--pendientes');
if (!service || service.startsWith('--')) {
  console.error('Uso: node scripts/openapi-coverage.mjs --service <CORE|RESTOBAR|...> [--pendientes]');
  process.exit(1);
}

const spec = JSON.parse(readFileSync(`docs/openapi/${service.toLowerCase()}-openapi.json`, 'utf8'));
const grupos = new Map();

for (const [path, metodos] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(metodos)) {
    const grupo = op.tags?.[0] ?? '(sin tag)';
    if (!grupos.has(grupo)) grupos.set(grupo, { total: 0, conSummary: 0, conRespuesta: 0, pendientes: [] });
    const g = grupos.get(grupo);
    g.total++;

    const ok = Object.entries(op.responses ?? {}).find(([c]) => c.startsWith('2'));
    const esSinCuerpo = ok && (ok[0] === '204' || !ok[1].content);
    const schema = ok?.[1].content && Object.values(ok[1].content)[0]?.schema;
    const respuestaUtil = esSinCuerpo || (schema && !(schema.type === 'object' && !schema.properties && !schema.additionalProperties));

    if (op.summary) g.conSummary++;
    if (respuestaUtil) g.conRespuesta++;
    const faltas = [!op.summary && 'summary', !respuestaUtil && 'tipo de respuesta'].filter(Boolean);
    if (faltas.length) g.pendientes.push(`${method.toUpperCase()} ${path} → falta ${faltas.join(' + ')}`);
  }
}

const pct = (a, b) => `${Math.round((a / b) * 100)}%`.padStart(4);
let total = 0, sum = 0, resp = 0;
console.log(`\n📘 Cobertura OpenAPI ${service}\n`);
console.log('Grupo'.padEnd(34), 'Ops', ' Summary', ' Respuesta');
for (const [nombre, g] of [...grupos].sort((a, b) => a[1].conSummary / a[1].total - b[1].conSummary / b[1].total)) {
  total += g.total; sum += g.conSummary; resp += g.conRespuesta;
  console.log(nombre.slice(0, 33).padEnd(34), String(g.total).padStart(3), `   ${pct(g.conSummary, g.total)}`, `     ${pct(g.conRespuesta, g.total)}`);
  if (verPendientes) g.pendientes.forEach((p) => console.log(`    · ${p}`));
}
console.log('─'.repeat(58));
console.log('TOTAL'.padEnd(34), String(total).padStart(3), `   ${pct(sum, total)}`, `     ${pct(resp, total)}`);
